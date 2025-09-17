// src/starter-components/widgets/AIHelper.jsx
import React, { useState } from "react";

export default function AIHelper() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm your AI assistant. How can I help you today?", sender: "ai" }
  ]);
  const [inputText, setInputText] = useState("");

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage = { id: Date.now(), text: inputText, sender: "user" };
      setMessages(prev => [...prev, newMessage]);
      
      // Simulate AI response
      setTimeout(() => {
        const responses = [
          "I'm a placeholder AI assistant. In a real implementation, I would be connected to OpenAI, Copilot, or another AI service.",
          "You can integrate me with various AI APIs like OpenAI GPT, Google Bard, or Microsoft Copilot.",
          "I can help with KPI analysis, procedure guidance, and operational insights once properly configured.",
          "To implement real AI functionality, you'll need to add API keys and integrate with your preferred AI service."
        ];
        
        const aiResponse = {
          id: Date.now() + 1,
          text: responses[Math.floor(Math.random() * responses.length)],
          sender: "ai"
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
      
      setInputText("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl border w-80 h-96 mb-4 flex flex-col">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg flex items-center justify-between">
            <h4 className="font-semibold">🤖 AI Helper</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 rounded-lg max-w-xs ${
                    msg.sender === "ai"
                      ? "bg-gray-100 text-gray-800"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              💡 This is a demo widget. Integrate with OpenAI, Copilot, or your preferred AI service.
            </div>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-xl"
        title="AI Helper - Click to chat"
      >
        {isOpen ? "✕" : "🤖"}
      </button>
    </div>
  );
}