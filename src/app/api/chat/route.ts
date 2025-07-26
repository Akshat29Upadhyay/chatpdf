import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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
        const contents = [
          {
            parts: [
              { text: message },
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

    // If no fileUrl or Gemini fails, fallback to OpenAI/Gemini as before
    if (!aiResponse) {
      // Try OpenAI first
      if (process.env.OPENAI_API_KEY) {
        try {
          const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: message },
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
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are a helpful AI assistant. Please respond to: ${message}` }] }]
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