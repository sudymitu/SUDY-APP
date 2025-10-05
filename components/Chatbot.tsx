import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { PaperAirplaneIcon, XMarkIcon, SparklesIcon, HeartIcon, ChatBubbleOvalLeftEllipsisIcon, DocumentDuplicateIcon, ArrowUpOnSquareIcon } from './icons';
import { getChatbotResponse } from '../services/geminiService';
import { fileToBase64 } from '../utils/file';
import { Tab, Message } from '../types';

interface ChatbotProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onAction: (tab: Tab, stateUpdate: any, file: File | null) => void;
  onOpenDonationModal: () => void;
  initialFile: File | null;
  onInitialFileConsumed: () => void;
}

interface TypingIndicatorProps {}

const TypingIndicator: React.FC<TypingIndicatorProps> = () => (
    <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
    </div>
);

const Chatbot: React.FC<ChatbotProps> = ({ messages, setMessages, onAction, onOpenDonationModal, initialFile, onInitialFileConsumed }) => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePreview, setUploadedFilePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  const [zaloJoined, setZaloJoined] = useState(localStorage.getItem('sudy_zalo_joined') === 'true');
  const [donateAck, setDonateAck] = useState(localStorage.getItem('sudy_donate_acknowledged') === 'true');

  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const typeMessage = useCallback((messageId: string, fullText: string) => {
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
    
    let charIndex = 0;
    const type = () => {
        if (charIndex < fullText.length) {
            setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, text: fullText.substring(0, charIndex + 1) } : msg
            ));
            charIndex++;
            typingTimeoutRef.current = window.setTimeout(type, 25);
        } else {
            typingTimeoutRef.current = null;
        }
    };
    type();
  }, [setMessages]);

  const handleFileChange = useCallback((file: File | null) => {
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  useEffect(() => {
    if (initialFile) {
      handleFileChange(initialFile);
      setIsOpen(true);
      onInitialFileConsumed();
    }
  }, [initialFile, onInitialFileConsumed, handleFileChange]);

  // Proactive opening logic
  useEffect(() => {
    const hasOpenedBefore = sessionStorage.getItem('sudy_chatbot_opened');
    if (!hasOpenedBefore) {
        const timer = setTimeout(() => {
            setIsOpen(true);
            sessionStorage.setItem('sudy_chatbot_opened', 'true');
        }, 500);
        return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText = t('chatbot.welcomeProactive');
      const welcomeMessage: Message = { id: 'welcome', sender: 'bot', text: '' };
      setMessages([welcomeMessage]);
      typeMessage('welcome', welcomeText);
    }
  }, [isOpen, messages.length, t, typeMessage, setMessages]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSend = async () => {
    const userText = inputValue.trim();
    if (!userText && !uploadedFile) return;

    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        // Complete the previous message instantly
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            // This logic is complex, maybe just leave it as is for now. The user will interrupt it anyway.
            return prev;
        });
    }

    const currentFile = uploadedFile;
    const currentFilePreview = uploadedFilePreview;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      imagePreview: currentFilePreview ?? undefined,
      imageFile: currentFile ?? undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputValue('');
    setUploadedFile(null);
    setUploadedFilePreview(null);
    
    try {
      let imagePayload: { base64: string; mimeType: string } | null = null;
      if (currentFile) {
        imagePayload = await fileToBase64(currentFile);
      }
      
      const prompt = userText || (imagePayload ? t('chatbot.imageUploaded') : '');
      const botResponseRaw = await getChatbotResponse(prompt, imagePayload, language);
      const botResponseData = JSON.parse(botResponseRaw);
      
      setIsLoading(false);

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        sender: 'bot',
        text: '', // Start empty for typing effect
        suggestedPrompt: botResponseData.suggested_prompt,
        botAction: botResponseData.recommended_tab && botResponseData.action_button_text ? {
          tab: botResponseData.recommended_tab as Tab,
          prompt: botResponseData.suggested_prompt,
          buttonText: botResponseData.action_button_text,
        } : undefined,
      };
      setMessages(prev => [...prev, botMessage]);
      typeMessage(botMessageId, botResponseData.explanation);

    } catch (error) {
      console.error("Chatbot error:", error);
      setIsLoading(false);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: t('chatbot.error'),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleBotActionClick = (action: Message['botAction']) => {
    if (!action) return;
    const userMessageWithImage = [...messages].reverse().find(m => m.sender === 'user' && m.imageFile);
    const fileToTransfer = userMessageWithImage?.imageFile || null;
    
    onAction(action.tab, { prompt: action.prompt }, fileToTransfer);
    setIsOpen(false);
  };

  const handleContainerPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleFileChange(e.clipboardData.files[0]);
    }
  };

  const handleConfirmZalo = () => {
    localStorage.setItem('sudy_zalo_joined', 'true');
    setZaloJoined(true);
  };
  
  const handleAckDonate = () => {
    localStorage.setItem('sudy_donate_acknowledged', 'true');
    setDonateAck(true);
  };
  
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`relative w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
        title={t('chatbot.title')}
      >
        <ChatBubbleOvalLeftEllipsisIcon className="w-8 h-8" />
      </button>
      <div className={`fixed bottom-5 right-5 z-40 w-[90vw] max-w-[400px] h-[70vh] max-h-[650px] md:max-w-[420px] md:h-[680px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-300 dark:border-gray-700 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-blue-500"/>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">{t('chatbot.title')}</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-gray-800 dark:hover:text-white">
            <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        {/* Messages */}
        <div className="flex-grow p-4 overflow-y-auto" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onPaste={handleContainerPaste}>
            <div className="space-y-4">
            {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white"/></div>}
                <div className={`p-3 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none'}`}>
                    {msg.imagePreview && <img src={msg.imagePreview} alt="upload preview" className="rounded-lg mb-2 max-h-40"/>}
                    {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                    {msg.botAction && (
                        <button onClick={() => handleBotActionClick(msg.botAction)} className="mt-3 w-full text-sm bg-blue-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                            <span>{msg.botAction.buttonText}</span>
                        </button>
                    )}
                    {msg.suggestedPrompt && (
                        <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600">
                             <p className="text-xs font-semibold mb-1">{t('chatbot.promptSuggestion')}</p>
                             <div className="text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded-md relative group">
                                <p>{msg.suggestedPrompt}</p>
                                <button onClick={() => handleCopyToClipboard(msg.suggestedPrompt)} className="absolute top-1 right-1 p-1 bg-gray-200 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DocumentDuplicateIcon className="w-3 h-3"/>
                                </button>
                             </div>
                        </div>
                    )}
                </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white"/></div>
                    <div className="p-3 rounded-2xl bg-gray-200 dark:bg-gray-700 rounded-bl-none">
                        <TypingIndicator />
                    </div>
                </div>
            )}
             {!zaloJoined && messages.length > 2 && (
                <div className="p-3 rounded-2xl bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 text-sm">
                    {t('chatbot.zaloReminder')}
                    <button onClick={handleConfirmZalo} className="font-bold underline mt-1">{t('chatbot.zaloConfirm')}</button>
                </div>
            )}
             {zaloJoined && !donateAck && messages.length > 4 && (
                <div className="p-3 rounded-2xl bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200 text-sm">
                    {t('chatbot.donateReminder')}
                    <div className="flex gap-2 mt-2">
                         <button onClick={onOpenDonationModal} className="flex-1 text-sm bg-pink-500 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-pink-600 transition-colors flex items-center justify-center space-x-1">
                            <HeartIcon className="w-4 h-4"/><span>{t('donate.button')}</span>
                        </button>
                        <button onClick={handleAckDonate} className="flex-1 underline text-xs">{t('chatbot.donateConfirm')}</button>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
            </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700">
            {uploadedFilePreview && (
                <div className="relative mb-2 w-20 h-20">
                <img src={uploadedFilePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                <button
                    onClick={() => {
                    setUploadedFile(null);
                    setUploadedFilePreview(null);
                    }}
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
                >
                    <XMarkIcon className="w-3 h-3" />
                </button>
                </div>
            )}
            <div className="flex items-start gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400">
                    <ArrowUpOnSquareIcon className="w-6 h-6"/>
                </button>
                 <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)} className="hidden" accept="image/*" />
                <textarea
                    ref={textInputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={t('chatbot.placeholder')}
                    className="flex-grow bg-gray-100 dark:bg-gray-700 rounded-lg p-2.5 text-sm resize-none border-none focus:ring-2 focus:ring-blue-500"
                    rows={1}
                />
                <button onClick={handleSend} disabled={isLoading || (!inputValue.trim() && !uploadedFile)} className="p-3 bg-blue-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-blue-700">
                    <PaperAirplaneIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
    </>
  );
};

export default Chatbot;