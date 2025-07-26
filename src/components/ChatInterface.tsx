'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Upload } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  time: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your AI assistant. Ask me anything!",
      isUser: false,
      time: new Date().toLocaleTimeString([], { hour12: false })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // PDF Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('');
    setUploadedFileName('');
    setUploadedFileUrl('');

    if (file.type !== 'application/pdf') {
      setUploadStatus('Please upload a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('File size must be less than 10MB.');
      return;
    }

    setIsLoading(true);
    setUploadStatus('Uploading PDF...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/pdf-upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        setUploadStatus('Upload failed.');
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      setUploadStatus('Upload successful!');
      setUploadedFileName(file.name);
      if (data.fileUrl) {
        setUploadedFileUrl(data.fileUrl);
      }
    } catch (error) {
      setUploadStatus('Upload failed.');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const now = new Date();
    const userMessage: Message = {
      id: now.getTime().toString(),
      text: inputMessage,
      isUser: true,
      time: now.toLocaleTimeString([], { hour12: false })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setStatus('Waiting for response...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.text, fileUrl: uploadedFileUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        setStatus('Error: ' + (error.error || 'Unknown error'));
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      if (data.response) {
        const nowAI = new Date();
        const aiMessage: Message = {
          id: (nowAI.getTime() + 1).toString(),
          text: data.response,
          isUser: false,
          time: nowAI.toLocaleTimeString([], { hour12: false })
        };
        setMessages(prev => [...prev, aiMessage]);
        setStatus('');
      } else {
        setStatus('No response from AI.');
      }
    } catch (error) {
      setStatus('Error: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      {/* PDF Upload Section - Left Side */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-md p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload PDF
          </h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              id="pdf-upload"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            <label htmlFor="pdf-upload" className={`cursor-pointer block ${isLoading ? 'opacity-50' : ''}`}>
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                {isLoading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-500">
                PDF files only (max 10MB)
              </p>
            </label>
          </div>
          {/* Upload Status */}
          {uploadStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              uploadStatus.includes('successful')
                ? 'bg-green-100 text-green-700'
                : uploadStatus.includes('failed')
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {uploadStatus}
              {uploadedFileName && uploadStatus.includes('successful') && (
                <span className="block mt-1 text-xs text-green-700">{uploadedFileName}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface - Right Side */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md h-[600px] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">AI Chat</h3>
            <p className="text-sm text-gray-500">
              Ask anything and get instant answers from OpenAI or Gemini.
            </p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`rounded-lg p-3 max-w-xs lg:max-w-lg xl:max-w-xl ${
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {message.isUser ? (
                      <p className="text-sm">{message.text}</p>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                            p: ({children}) => <p className="mb-2">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                            li: ({children}) => <li className="text-sm leading-tight">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                            em: ({children}) => <em className="italic">{children}</em>,
                            code: ({children}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">{children}</code>,
                            blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-2 italic">{children}</blockquote>,
                          }}
                        >
                          {message.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Status Message */}
          {status && (
            <div className={`px-4 py-2 text-sm ${status.startsWith('Error') ? 'text-red-600' : 'text-blue-600'}`}>{status}</div>
          )}

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isLoading ? 'Waiting for response...' : 'Type your message...'}
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}