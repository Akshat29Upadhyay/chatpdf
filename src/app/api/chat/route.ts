import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchChunks } from '@/lib/pinecone';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, fileUrl } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let aiResponse = null;
    let contextFromPinecone = '';

    // Try to get relevant context from Pinecone first
    if (process.env.PINECONE_API_KEY) {
      try {
        const relevantChunks = await searchChunks(message, userId, 3);
        if (relevantChunks.length > 0) {
          contextFromPinecone = `\n\nRelevant information from your documents:\n${relevantChunks.map(chunk => 
            `[From: ${chunk.pdfName}]\n${chunk.text}\n`
          ).join('\n')}`;
          console.log('Found relevant context from Pinecone');
        }
      } catch (pineconeError) {
        console.error('Pinecone search failed:', pineconeError);
        // Continue without Pinecone context
      }
    }

    // If fileUrl is present, fetch the PDF, convert to base64, and send as inlineData to Gemini
    if (fileUrl && process.env.GEMINI_API_KEY) {
      try {
        // Fetch the PDF from Uploadcare
        const pdfRes = await fetch(fileUrl);
        if (!pdfRes.ok) {
          throw new Error('Failed to fetch PDF from Uploadcare');
        }
        const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
        const pdfBase64 = pdfBuffer.toString('base64');
        
        // Include Pinecone context in the prompt
        const enhancedMessage = contextFromPinecone 
          ? `${message}\n\nAdditional context:${contextFromPinecone}`
          : message;
          
        const contents = [
          {
            parts: [
              { text: enhancedMessage },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64
                }
              }
            ]
          }
        ];
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contents }),
        });
        if (geminiRes.ok) {
          const data = await geminiRes.json();
          aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } else {
          const error = await geminiRes.text();
          console.error('Gemini multimodal API error:', error);
        }
      } catch (err) {
        console.error('Gemini multimodal error:', err);
      }
    }

    // If no fileUrl or Gemini fails, try with Pinecone context
    if (!aiResponse) {
      // Try OpenAI first
      if (process.env.OPENAI_API_KEY) {
        try {
          const enhancedMessage = contextFromPinecone 
            ? `${message}\n\nAdditional context:${contextFromPinecone}`
            : message;
            
          const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { 
                  role: 'system', 
                  content: contextFromPinecone 
                    ? 'You are a helpful assistant with access to the user\'s documents. Use the provided context to give accurate and relevant answers.'
                    : 'You are a helpful assistant.'
                },
                { role: 'user', content: enhancedMessage },
              ],
              max_tokens: 512,
            }),
          });

          if (openaiRes.ok) {
            const data = await openaiRes.json();
            aiResponse = data.choices?.[0]?.message?.content || null;
          } else {
            const error = await openaiRes.text();
            console.error('OpenAI API error:', error);
          }
        } catch (err) {
          console.error('OpenAI API error:', err);
        }
      }

      // If OpenAI failed, try Gemini text-only
      if (!aiResponse && process.env.GEMINI_API_KEY) {
        try {
          const enhancedMessage = contextFromPinecone 
            ? `${message}\n\nAdditional context:${contextFromPinecone}`
            : message;
            
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are a helpful AI assistant. Please respond to: ${enhancedMessage}` }] }]
            }),
          });

          if (geminiRes.ok) {
            const data = await geminiRes.json();
            aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          } else {
            const error = await geminiRes.text();
            console.error('Gemini API error:', error);
          }
        } catch (err) {
          console.error('Gemini API error:', err);
        }
      }
    }

    // If all fail, return a generic message
    if (!aiResponse) {
      return NextResponse.json({ response: "Sorry, I couldn't answer that right now. Please try again later." });
    }

    return NextResponse.json({ response: aiResponse, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ response: "Sorry, I couldn't answer that right now. Please try again later." });
  }
} 