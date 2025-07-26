import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default async function ChatsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="w-screen min-h-screen bg-gradient-to-r from-rose-100 to-teal-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Chat with Your PDFs</h1>
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Home
          </a>
        </div>
        
        <ChatInterface />
      </div>
    </div>
  );
} 