"use client";
import { UploadDropzone } from "@uploadthing/react";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { OurFileRouter } from "../api/uploadthing/core";
import PublishForm from '@/components/PublishForm';
import { useUser } from "@/contexts/UserContext";
import { AnimatePresence, motion } from 'framer-motion';
import introJs from "intro.js";
import "intro.js/minified/introjs.min.css";  
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUploadBase64 } from "../api/uploadthing/uploadbase64";

interface Hyperparams {
  generationQuality: number;
  guidanceScale: number;
  imageInfluence: number; 
}
 
interface ImagePair {
  main: string | null;
  reference: string | null;
  selected: string | null;
  hyperparams?: Hyperparams | null;
  selectedModel?: string | null;  
  generatedImages?: Record<string, string> | null;  
}
interface MaskData {
  base_image: string;
  reference_image: string;
  base_mask: string;
  reference_mask: string;
}

interface SelectedModel {
  model_number: number;
}

interface IntentResult {
  selected_models: SelectedModel[];
}

interface FeedbackData {
  [key: string]: {
    imageQuality: number;
    followsInstructions: number;
    matchesOriginal: number;
    culturalRelevance: number;
    offensiveContent: boolean;
    offensiveContentDescription: string;
    isNatural: boolean
    detailedThoughts: string;
    
  };
}

interface FeedbackFormProps {
  generatedImages: Record<string, string>
  selectedModel: string
  onSubmit: (feedbackData: FeedbackData) => void
  randomizedOrder: string[]
  baseImage: string | null
  referenceImage: string | null
}

interface ConfirmModalProps {
  show: boolean;
  onConfirm: (confirmed: boolean) => void;
  imageUrl: string | null;
}

interface PlaceholderProps {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleAddStep: (prompt: string) => void;
}

interface ImageUploadProps {
  type: string;
  baseImage?: string;
  title: string;
  maskImageConverted?: string;
  handleUploadComplete: (type: string) => (res: any) => Promise<void>;
}

interface EndpointConfig {
  [key: string]: string;
}

const apiKey = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const endpoints: EndpointConfig = {
  ip2p: process.env.NEXT_PUBLIC_IP2P_ENDPOINT || '',
  invfree: process.env.NEXT_PUBLIC_INVFREE_ENDPOINT || '',
  control: process.env.NEXT_PUBLIC_CONTROL_ENDPOINT || '',
  deadiff: process.env.NEXT_PUBLIC_DEADIFF_ENDPOINT || '',
  paint: process.env.NEXT_PUBLIC_PAINT_ENDPOINT || '',
  powerPaint: process.env.NEXT_PUBLIC_POWER_PAINT_ENDPOINT || '',
  anyDoor: process.env.NEXT_PUBLIC_ANY_DOOR_ENDPOINT || ''
};


const placeholderPrompts = [
  "Convert these fruits with ones commonly associated with India, such as mango",
  "Transform this painting to reflect traditional Japanese art style",
  "Incorporate more traditional Chinese architecture and culture into this school",
  "Replace the American black bear with a tiger",
  "Change the dish to apple pie",
];

const Placeholder: React.FC<PlaceholderProps> = React.memo(
  ({ prompt, setPrompt, handleAddStep }) => {
    const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
    const [fadeState, setFadeState] = useState<'fade-in' | 'fade-out'>('fade-in');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (prompt !== '') return;

      const fadeOutTimer = setTimeout(() => {
        setFadeState('fade-out');
      }, 3000);

      const fadeInTimer = setTimeout(() => {
        setPlaceholderIndex(
          (prevIndex) => (prevIndex + 1) % placeholderPrompts.length
        );
        setFadeState('fade-in');
      }, 3500);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(fadeInTimer);
      };
    }, [prompt, placeholderIndex]);

    const adjustTextareaHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddStep(prompt);
      }
    };

    const handleClick = () => {
      handleAddStep(prompt);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
      adjustTextareaHeight();
    };

    return (
      <div className="flex flex-col mt-4 relative">
        <div className="flex items-center gap-4">
          <div className="flex-grow relative mt-2">
            <textarea
              id="promptEntry"
              ref={textareaRef}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              value={prompt}
              title="Placeholder"
              rows={1}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white text-gray-800 resize-none overflow-hidden text-base shadow-sm transition-all duration-200"
              style={{ minHeight: '50px' }}
            />
            {prompt === '' && (
              <div
                className={`absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none ${fadeState}`}
              >
                <span className="text-gray-400 text-base mb-1 ml-1 ">
                  {placeholderPrompts[placeholderIndex]}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleClick}
            className="min-w-[120px] h-[50px] bg-blue-500 text-white px-6 rounded-xl hover:bg-blue-600 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transform transition-all duration-200 ease-in-out hover:scale-105 flex items-center justify-center gap-2 shadow-md"
          >
            <span>Translate</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
        </div>
        <style jsx>{`
          .fade-in {
            animation: fadeIn 0.5s ease-in;
            opacity: 1;
          }
          .fade-out {
            animation: fadeOut 0.5s ease-out;
            opacity: 0;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }
);

export default function Home() {
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([]);
  const [currentPair, setCurrentPair] = useState<ImagePair>({ main: null, reference: null, selected: null, hyperparams: null });
  const [prompt, setPrompt] = useState<string>('');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showCanvas, setShowCanvas] = useState<boolean>(false);
  const [currentEditStep, setCurrentEditStep] = useState<number>(0);
  const { user } = useUser();
  const email = user?.email || '';
  const stepsRef = useRef<HTMLDivElement>(null);
  const [maskData, setMaskData] = useState<MaskData | null>(null);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fadeState, setFadeState] = useState('fade-in');

  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [generationQuality, setGenerationQuality] = useState<number>(30);
  const [controlStrength, setControlStrength] = useState<number>(1.0);
  const [guidanceScale, setGuidanceScale] = useState<number>(7.5);
  const [imageInfluence, setImageInfluence] = useState<number>(1.0);
  const [seed, setSeed] = useState<number>(-1);
  const [promptModel, setPromptModel] = useState<boolean>(false);

  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string> | null>(null);
  
  const [inputImage, setInput] = useState<string | null>(null);
  const [outputImage, setOutput] = useState<string | null>(null);

  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Record<string, any>>({});

  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<React.ReactNode>(null);
  const [alertText, setAlertText] = useState<string>("Error! Please ensure at least a base image is uploaded and you have entered something for your prompt.");
  const [intentModelOutput, setIntentModelOutput] = useState<any>(null);
  const [selectedModelNumbers, setSelectedModelNumbers] = useState<Set<number>>(new Set());

  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [totalFeedback, setTotalFeedback] = useState<Record<string, any>>({});

  const [prompts, setPrompts] = useState<Record<string, string>>({});

  const [detecting, setDetecting] = useState<boolean>(false);
  const [randomizedModelOrder, setRandomizedModelOrder] = useState<string[]>([]);
  const [generationQualityScale, setGenerationQualityScale] = useState<number>(1);
  const [controlStrengthScale, setControlStrengthScale] = useState<number>(1);
  const [guidanceScaleScale, setGuidanceScaleScale] = useState<number>(1);
  const [imageInfluenceScale, setImageInfluenceScale] = useState<number>(1);
  
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const alertTexts = ["Error! Please ensure at least a base image is uploaded, and you have entered something for your prompt.", "Error! Please confirm mask data before exiting the streamlit interface."];

  const [showTour, setShowTour] = useState(true);

  const [accordionIndex, setAccordionIndex] = useState(0);

  const [showConfirmationPage, setShowConfirmationPage] = useState<boolean>(false);

  const router = useRouter();
  

  const messages = [
    "Preparing the best diffusion models...",
    
   
  ];
  
  const [currentMessage, setCurrentMessage] = useState(0);

  let fullUrl = "";
  const uploadBase64 = useUploadBase64();

  const handleOpenCanvas = () => {
    deleteDocuments(email);
    setShowCanvas(true);
    setShowConfirmationPage(false);
  };

  

  const handleAddStep = useCallback(
    async (prompt: string) => {
      
      if (currentPair.main && prompt !== '') {
        const stepNumber = imagePairs.length;
        setDetecting(true);
        setPrompts((prevPrompts) => ({
          ...prevPrompts,
          [stepNumber]: prompt,
        }));
  
        const formData = new FormData();
        formData.append('image', currentPair.main);
        formData.append('task', prompt);
  
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_INTENT_API_URL}`, {
            method: 'POST',
            body: formData,
          });
  
          setDetecting(false);
  
          if (response.ok) {
            const result = await response.json();
            setIntentModelOutput(result);
            console.log(result)

  
            const selectedModels = result.selected_models.map(
              (model: SelectedModel) => model.model_number
            );
            setSelectedModelNumbers(new Set(selectedModels));
  
            if (imagePairs.length === 0) {
              setInput(currentPair.main);
            }
  
            setImagePairs([...imagePairs, { ...currentPair, selected: null }]);
            setAccordionIndex(stepNumber);
            if (currentPair.reference) {
              setShowConfirmationPage(true); 
            } else {
              setPromptModel(true);
            }
            setCurrentPair({ main: null, reference: null, selected: null });
            setCurrentEditStep(currentEditStep + 1);
          } else {
            console.error('Failed to detect intent:', response.statusText);
          }
        } catch (error) {
          console.error('Error detecting intent:', error);
        }
      } else {
        setAlertText(alertTexts[0]);
        setAlertMessage(
          <div role="alert" className="alert alert-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{alertTexts[0]}</span>
          </div>
        );
        setShowAlert(true);
        setDetecting(false);
      }
    },
    [
      currentPair,
      imagePairs,
      setDetecting,
      setPrompts,
      setIntentModelOutput,
      setSelectedModelNumbers,
      setInput,
      setImagePairs,
      setShowConfirmationPage,
      setPromptModel,
      setCurrentPair,
      setAlertText,
      alertTexts,
      setAlertMessage,
      setShowAlert,
    ]
  );


  const ConfirmationPage: React.FC = () => {
    const lastPair = imagePairs[imagePairs.length - 1];
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl max-w-4xl w-full relative shadow-2xl ">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Confirm Images</h2>
          <div className="flex justify-between mb-6">
            <div className="w-1/2 pr-4">
              <h3 className="text-xl font-semibold mb-2">Base Image</h3>
              <img src={lastPair.main || ''} alt="Base Image" className="w-full h-64 object-cover rounded-lg" />
            </div>
            <div className="w-1/2 pl-4">
              <h3 className="text-xl font-semibold mb-2">Reference Image</h3>
              <img src={lastPair.reference || ''} alt="Reference Image" className="w-full h-64 object-cover rounded-lg" />
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleOpenCanvas}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 font-semibold"
            >
              Open Canvas
            </button>
            
          </div>
          <p className="w-full text-black items-center text-center flex justify-center mt-6 ">
                When using a reference image, we use our canvas interface to obtain more information on your preferred translation.
          </p>
        </div>
      </div>
    );
  };

  const startTour1 = () => {
    const intro = introJs();

    const steps = [
      {
        element: "#uploadArea",
        intro: "Upload your base and reference images here. You must click twice to upload your image. Remember, only a base image is required while the reference image is optional.",
        title: "Upload Areas"
      },
      {
        element: "#stepsHeader",
        intro: "View your complete step history here. This area will show your translations.",
        title: "Step History"
      },
      {
        element: "#promptEntry",
        intro: "Enter your desired changes in this textbox. Click \"Translate\" when finished. Please make sure your base and/or reference images are loaded in before clicking translate.",
        title: "Prompt"
      },
      {
        element: "#inputResult",
        intro: "This is where you can view the input or initial image that will be saved in the gallery.",
        title: "Input Image"
      },
      {
        element: "#outputResult",
        intro: "This is where you can view the output or final image that will be saved in the gallery.",
        title: "Output Image"
      },
      {
        element: "#feedback",
        intro: "Once you're done, please complete all the information in this publish form, and hit \"Publish\" to save your translations privately or share it in the public gallery.",
        title: "Save and Share"
      },
    ];

    intro.setOptions({
      steps,
      showProgress: true,
      showBullets: false,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      nextLabel: 'NEXT →',
      prevLabel: '← BACK',
      doneLabel: 'FINISH'
    });

    intro.onafterchange((targetElement) => {
      if (targetElement.id === 'feedback') {
        const dontShowAgainBtn = document.createElement('button');
        dontShowAgainBtn.textContent = "Don't show again";
        dontShowAgainBtn.className = 'introjs-button introjs-dontshowagain';
        dontShowAgainBtn.onclick = () => {
          localStorage.setItem('dontShowTour1', 'true');
          intro.exit();
        };
        
        const tooltipButtons = document.querySelector('.introjs-tooltipbuttons');
        if (tooltipButtons) {
          tooltipButtons.insertBefore(dontShowAgainBtn, tooltipButtons.firstChild);
        } else {
          console.warn('Could not find .introjs-tooltipbuttons element');
        }
      }
    });
    intro.start();
  };

  const startTour2 = () => {
    const intro = introJs();
  
    const steps = [
      {
        element: "#preferences",
        intro: "Here you can adjust your preferences...",
        title: "Preferences"
      },
      {
        element: "#promptDisplay",
        intro: "This shows the prompt you have entered.",
        title: "Prompt Display"
      },
      {
        element: "#generateButton",
        intro: "Click here to generate images based on your input and preferences.",
        title: "Generate Images"
      },
    ];
  
    intro.setOptions({
      steps,
      showProgress: true,
      showBullets: false,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      nextLabel: 'NEXT →',
      prevLabel: '← BACK',
      doneLabel: 'FINISH'
    });
  
    intro.onafterchange((targetElement) => {
      if (targetElement.id === 'generateButton') {
        const dontShowAgainBtn = document.createElement('button');
        dontShowAgainBtn.textContent = "Don't show again";
        dontShowAgainBtn.className = 'introjs-button introjs-dontshowagain';
        dontShowAgainBtn.onclick = () => {
          localStorage.setItem('dontShowTour2', 'true');
          intro.exit();
        };
  
        const tooltipButtons = document.querySelector('.introjs-tooltipbuttons');
        if (tooltipButtons) {
          tooltipButtons.insertBefore(dontShowAgainBtn, tooltipButtons.firstChild);
        } else {
          console.warn('Could not find .introjs-tooltipbuttons element');
        }
      }
    });
  
    intro.start();
  };

  const handleBack = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/confirm-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
  
      const data = await response.json();
  
      if (data.exists) {
        setShowCanvas(false);
        fetchMaskData();
      } else {
        setAlertText(alertTexts[1]);
      
        const alertElement = (
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{alertTexts[1]}</span>
          </div>
        );
        
       
        setAlertMessage(alertElement);
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error confirming data:', error);
   
    }
  };
 


  useEffect(() => {
    console.log("Total Feedback updated:", totalFeedback);
  }, [totalFeedback]);

  useEffect(() => {
    console.log("current pair :", currentPair);
  }, [currentPair]);

  useEffect(() => {
    console.log("total pairs :", imagePairs);
  }, [imagePairs]);

  useEffect(() => {
    if (stepsRef.current) {
      stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
    }
  }, [imagePairs]);

  useEffect(() => {
    if (showAlert) {
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 4800);
  
      return () => clearTimeout(timer);
    }
  }, [showAlert]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .introjs-tooltip {
        background-color: white;
        color: black;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        padding: 20px;
        max-width: 400px;
      }
      .introjs-tooltiptext {
        font-size: 14px;
        line-height: 1.5;
      }
      .introjs-helperLayer {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
      }
      .introjs-button {
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        font-weight: 500;
        text-transform: uppercase;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      
      .introjs-nextbutton {
        background-color: white;
        color: black;
      }
     
      .introjs-skipbutton {
        color: #666;
        right: 10px;
        top: 10px;
        padding: 4px;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .introjs-progress {
        background-color: #e0e0e0;
        height: 4px;
        width: 100%;
        margin-top: 10px;
      }
      .introjs-progressbar {
        background-color: #000;
        height: 100%;
      }
      .introjs-tooltipbuttons {
        margin-top: 20px;
      }
      .introjs-dontshowagain {
        background-color: #f0f0f0;
        color: #333;
        margin-bottom:15px;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    const dontShowTour1 = localStorage.getItem('dontShowTour1');
    if (dontShowTour1 !== 'true' && user != null) {
      startTour1();
    } else {
      setShowTour(false);
    }
  }, []);
  
  useEffect(() => {
    if (maskData || promptModel) {
      const dontShowTour2 = localStorage.getItem('dontShowTour2');
      if (dontShowTour2 !== 'true') {
        startTour2();
      }
    }
  }, [maskData, promptModel]);  

  const handleKeyDown = useCallback((event: any) => {
    if (event.key === 'Enter') {
      handleAddStep(prompt);
    }
  }, [handleAddStep]);

  function resetPageAfterPublish() {
    setMaskData(null);
    setCurrentPair({ main: null, reference: null, selected: null, hyperparams: null });
    setImagePairs([]);
    setPromptModel(false);
    setInput(null);
    setOutput(null);
  }

  function toDataUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.onload = function() {
        var reader = new FileReader();
        reader.onloadend = function() {
          resolve(reader.result as string);
        }
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = reject;
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.send();
    });
  }

  async function deleteDocuments(email: string) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/delete-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
  
      const result = await response.json();
      console.log(result.message); 
    } catch (error) {
      console.error('Failed to delete documents:', error);
    }
  }

  const handleUploadComplete = (type: 'main' | 'reference') => async (res: any) => {
    if (res && res.length > 0) {
      const uploadedFile = res[0];
      setCurrentPair(prev => ({ ...prev, [type]: uploadedFile.url }));
    }
  };



  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function checkJobStatus(endpoint: string, id: string): Promise<string> {
    const statusUrl = `https://api.runpod.ai/v2/${endpoint}/status/${id}`;
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.status;
  }

  async function waitForJobCompletion(endpoint: string, id: string): Promise<void> {
    while (true) {
      const status = await checkJobStatus(endpoint, id);
      if (status === 'COMPLETED') {
        break;
      } else if (status === 'FAILED') {
        throw new Error('Job failed');
        
      }
      await sleep(1000); 
    }
  }

  const callIp2p = async (imageUrl: string, prompt: string, parameters: any) => {
    const endpoint = endpoints.ip2p;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        image_url: imageUrl,
        edit_prompt: prompt,
        steps: Math.round(100 * generationQualityScale),
        resolution: 512,
        cfg_text: 7.5 * guidanceScaleScale,
        cfg_img: 1.5 * imageInfluenceScale,
        seed: null
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("IP2P API response:", finalData);
      if (typeof finalData.output === 'string' && finalData.output.startsWith('data:image')) {
        return { ...finalData, output: finalData.output };
      } else if (typeof finalData.output === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling ip2p', error);
      throw error;
    }
  };

  const callInvFree = async (imageUrl: string, sourcePrompt: string, targetPrompt: string) => {
    const endpoint = endpoints.invfree;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        image: imageUrl,
        source_prompt: sourcePrompt,
        target_prompt: targetPrompt,
        target_blend: "",
        source_blend: "",
        steps: Math.round(15*generationQualityScale)
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("invfree API response:", finalData);
      if (typeof finalData.output === 'string' && finalData.output.startsWith('data:image')) {
        return { ...finalData, output: finalData.output };
      } else if (typeof finalData.output === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling invfree', error);
      throw error;
    }
  };

  const callControl = async (imageUrl: string, prompt: string) => {
    const endpoint = endpoints.control;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        image: imageUrl,
        prompt: prompt,
        resolution: 512,
        strength: 1,
        guidance_scale: 9,
        low_thresh: 50,
        high_thresh: 200,
        steps: 30
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("Control API response:", finalData);
      if (typeof finalData.output === 'string' && finalData.output.startsWith('data:image')) {
        return { ...finalData, output: finalData.output };
      } else if (typeof finalData.output === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling control', error);
      throw error;
    }
  };

  const callDeadiff = async (imageUrl: string, prompt: string) => {
    const endpoint = endpoints.deadiff;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        image: imageUrl,
        prompt: prompt,
        subject_text: "style & content",
        steps: Math.round(25 * generationQualityScale),
        cfg: 8 * guidanceScaleScale,
        weight: 1,
        seed: -1

      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("dead API response:", finalData);
      if (typeof finalData.output === 'string' && finalData.output.startsWith('data:image')) {
        return { ...finalData, output: finalData.output };
      } else if (typeof finalData.output === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling dead', error);
      throw error;
    }
  };

  const callPaint = async (imageUrl: string, base_mask: string, ref_image: string) => {
    const endpoint = endpoints.paint;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        base_image: imageUrl,
        base_mask: base_mask,
        ref_image: ref_image,
        ddim_steps: Math.round(30 * generationQualityScale),
        scale: 5 * guidanceScaleScale

      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("paint API response:", finalData);
      if (typeof finalData.output.image === 'string' && finalData.output.image.startsWith('data:image')) {
        return { ...finalData, output: finalData.output.image };
      } else if (typeof finalData.output.image === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output.image}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling paint', error);
      throw error;
    }
  };

  const callPowerPaint = async (imageUrl: string, base_mask: string, prompt: string, neg_prompt: string) => {
    const endpoint = endpoints.powerpaint;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        inputs: {
          input_image: imageUrl,
          mask: base_mask,
          prompt: prompt,
          negative_prompt: neg_prompt,
          task: "text-guided",
          ddim_steps: Math.round(45 * generationQualityScale),
          scale: 7.5 * guidanceScaleScale,
          seed: 42
        }
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("paint API response:", finalData);
      if (typeof finalData.output.image === 'string' && finalData.output.image.startsWith('data:image')) {
        return { ...finalData, output: finalData.output.image };
      } else if (typeof finalData.output.image === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output.image}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling paint', error);
      throw error;
    }
  };



  const callAnyDoor = async (base_image_b64: string, base_mask_b64: string, ref_image_b64: string, ref_mask_b64: string ) => {
    const endpoint = endpoints.anyDoor;
    const apiUrl = `https://api.runpod.ai/v2/${endpoint}/run`;

    const inputData = {
      input: {
        mode: "run_local",
        base_image: base_image_b64,
        base_mask: base_mask_b64,
        ref_image: ref_image_b64,
        ref_mask: ref_mask_b64,
        strength: imageInfluenceScale,
        ddim_steps: Math.round(50 * generationQualityScale),
        scale: 7.5 * guidanceScaleScale,
        seed: 42,
        enable_shape_control: false
       
      }
    };
  
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(inputData),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      await waitForJobCompletion(endpoint, data.id);

      const result = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${data.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const finalData = await result.json();

      console.log("anydoor API response:", finalData);
      if (typeof finalData.output.image === 'string' && finalData.output.image.startsWith('data:image')) {
        return { ...finalData, output: finalData.output.image };
      } else if (typeof finalData.output.image === 'string') {
        const outputImageUrl = `data:image/png;base64,${finalData.output.image}`;
        return { ...finalData, output: outputImageUrl };
      } else {
        throw new Error('Unexpected output format from API');
      }
    } catch (error) {
      console.error('Error calling anydoor', error);
      throw error;
    }
  };

  
  if (detecting) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-gray-100 to-gray-300 items-center justify-center">
   
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 border-8 border-indigo-600 border-t-transparent rounded-full shadow-xl"
        />
  
        
        <motion.p
        key={currentMessage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
        className="mt-6 text-xl text-gray-600 font-medium"
        >
          {messages[currentMessage]}
        </motion.p>
  
      
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-4 text-2xl text-center font-semibold text-transparent bg-clip-text bg-black"
        >
          "{prompt}"
        </motion.p>
      </div>
    );
  }


  const fetchMaskData = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/fetch-mask/${email}`);
      if (response.ok) {
        const data = await response.json();
        setMaskData(data);
        setShowCanvas(false);
      } else {
        console.error("Failed to fetch mask data:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching mask data:", error);
    }

  };

  const handleDeleteStep = (index: number) => {
    setImagePairs(prevPairs => {
      const newPairs = prevPairs.slice(0, index);
      
      if (index === 0) {
        setInput(prevPairs[0].main);
        setOutput(null);
        setCurrentPair({
          main: prevPairs[0].main,
          reference: prevPairs[0].reference,
          selected: null
        });
      } else {
        const previousStep = newPairs[newPairs.length - 1];
        setOutput(previousStep.selected ? previousStep.selected.replace('.selected', '') : null);
        
        setCurrentPair({
          main: previousStep.selected,
          reference: previousStep.reference,
          selected: null
        });
      }
      
      if (newPairs.length > 0) {
        setInput(newPairs[0].main);
      } else {
        setInput(null);
      }
      
      return newPairs;
    });
    
    setExpandedStep(null);
    setShowCanvas(false);
    setPromptModel(false);
    setMaskData(null);
    setGeneratedImages(null);
    setSelectedModel(null);
  };

  const handleRemoveImage = (type: 'main' | 'reference') => {
    if (type === 'main') {
      setCurrentPair(prev => ({ ...prev, main: null, selected: null }));
    } else if (type === 'reference') {
      setCurrentPair(prev => ({ ...prev, reference: null, selected: null }));
    }
  };

  const renderUploadArea = (type: 'main' | 'reference') => {
    if (promptModel) {
      return (
        <div className="w-full md:w-[48%] rounded-xl border-2 border-gray-200 p-6 mb-4 md:mb-0 bg-white shadow-lg transition-all duration-300">
          <h2 className="text-xl font-semibold mb-4 text-blue-600 text-center">Base Image</h2>
          <div className="relative w-full h-80 flex items-center justify-center overflow-hidden rounded-xl">
            <Image
              src={imagePairs[imagePairs.length - 1]?.main || ''}
              alt="Base Image"
              layout="fill"
              objectFit="contain"
              className="absolute inset-0 transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>
      );
    }
  
    const baseImage = currentPair[type] || (maskData ? maskData[type === 'main' ? 'base_image' : 'reference_image'] : null);
    const maskImage = maskData ? maskData[type === 'main' ? 'base_mask' : 'reference_mask'] : null;
    const title = type === 'main' ? 'Base Image' : 'Reference Image (Optional)';
    const maskImageConverted = maskImage ? `data:image/png;base64,${maskImage}` : null;
  
    return (
      <div className="w-full md:w-[48%] rounded-xl border-2 border-gray-200 p-6 mb-4 md:mb-0 bg-white shadow-lg transition-all duration-300 hover:border-blue-300">
        <h2 className="text-xl font-semibold mb-4 text-blue-600 text-center">
          {title}
          {/*type === 'reference' && (
            <span className="text-sm font-normal text-gray-500 block mt-1">
              Upload a reference image to guide the translation
            </span>
          )*/} 
        </h2>
        
        {!baseImage ? (
            <UploadDropzone<OurFileRouter, "imageUploader">
            endpoint="imageUploader"
            onClientUploadComplete={handleUploadComplete(type)}
            onUploadError={(error: Error) => {
              alert(`ERROR! ${error.message}`);
            }}
            className="bg-gray-50 hover:bg-blue-50 border-2 border-dashed border-gray-300 hover:border-blue-400 
              h-80 w-full flex flex-col items-center justify-center text-gray-500 hover:text-blue-500 
              rounded-xl cursor-pointer transition-all duration-300 group"
          />
          ): (
          <div className="relative w-full h-80 flex items-center justify-center overflow-hidden rounded-xl group">
            <Image
              src={baseImage}
              alt={title}
              layout="fill"
              objectFit="contain"
              className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
            />
            {maskImageConverted && (
              <div className="absolute inset-0">
                <Image
                  src={maskImageConverted}
                  alt={`${title} Mask`}
                  layout="fill"
                  objectFit="contain"
                  className="absolute inset-0 opacity-50"
                />
              </div>
            )}
            {(!maskData && !promptModel) && (
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex justify-end items-start">
                <button
                  onClick={() => handleRemoveImage(type)}
                  className="opacity-0 group-hover:opacity-100 m-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full 
                    transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg"
                  title="Remove Image"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }; 

  const renderStep = (pair: ImagePair, index: number) => {
    const renderImage = (src: string | null, alt: string, isSelected: boolean = false) => (
      <div className="relative w-full h-32 group">
        <Image 
          src={src || ''}
          alt={alt} 
          layout="fill" 
          objectFit="cover" 
          className={`rounded-lg ${isSelected ? 'border-4 border-blue-500' : ''}`} 
        />
        
        {isSelected && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
            Selected
          </div>
        )}
      </div>
    );
  
    return (
      <div key={index} className="border-b border-gray-300 p-4">
        <div className="mt-4">
          <div className="mb-2">
            <h4 className="text-md font-semibold mb-1">Base Image</h4>
            {renderImage(pair.main, "Base")}
          </div>
          {pair.reference && (
            <div className="mb-2">
              <h4 className="text-md font-semibold mb-1">Reference Image</h4>
              {renderImage(pair.reference, "Reference")}
            </div>
          )}
          {pair.selected && (
            <div className="mb-2">
              <h4 className="text-md font-semibold mb-1">Selected Image</h4>
              {renderImage(pair.selected.replace('.selected', ''), "Selected", true)}
            </div>
          )}
          <button 
            onClick={() => handleDeleteStep(index)}
            className="mt-2 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center w-full justify-center"
          >
            Delete Step
          </button>
        </div>
      </div>
    );
  };

 

  function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  const renderGenerate = () => {
    const handleGenerate = async () => {
      setIsGenerating(true);
      const startTime = performance.now();
      try {
        let mockImages : Record<string, string>  = {};
  
        const baseImageUrl = imagePairs[imagePairs.length-1].main;
        const refImageUrl = imagePairs[imagePairs.length-1].reference;
  
        const [baseImageDataUrl, refImageDataUrl] = await Promise.all([

          toDataUrl(baseImageUrl ? baseImageUrl : ''),
          toDataUrl(refImageUrl ? refImageUrl : '')
        ]);
  
        const baseImageBase64 = baseImageDataUrl.split(',')[1];
        const refImageBase64 = refImageDataUrl.split(',')[1];
  
        console.log(baseImageBase64); 
        console.log(refImageBase64)
      
        const modelPromises = [
          // Model 1: IP2P
          
          (async () => {
            const model1Data = intentModelOutput.selected_models.find((model : SelectedModel) => model.model_number === 1);
            const prompt1 = model1Data.prompt;
            const ip2pResult = await callIp2p(
              imagePairs[imagePairs.length-1]?.main || '',

              prompt1,
              {
                steps: generationQuality,
                cfg_text: guidanceScale,
                cfg_img: imageInfluence,
                seed: seed
              }
            );
            return { model: 'IP2P', output: ip2pResult.output };
          })(),
          
          
          // Model 2: Deadiff
          (async () => {
            const model2Data = intentModelOutput.selected_models.find((model:SelectedModel) => model.model_number === 2);
            const prompt2 = model2Data.prompt;
            const deadResult = await callDeadiff(
              imagePairs[imagePairs.length-1]?.main || '',
              prompt2
            );
            return { model: 'DEADiff', output: deadResult.output };
          })(),

          
          // Model 3: ControlNet
          (async () => {
            const model3Data = intentModelOutput.selected_models.find((model:SelectedModel) => model.model_number === 3);
            const prompt3 = model3Data.prompt;
            console.log(prompt)
            console.log(imagePairs[imagePairs.length-1]?.main)
            const controlResult = await callControl(
              imagePairs[imagePairs.length-1]?.main || '',
              prompt3, 
            );
            return { model: 'ControlNet', output: controlResult.output };
          })(),
        
          
          // Model 4: InvFree
          (async () => {
            const model4Data = intentModelOutput.selected_models.find((model:SelectedModel) => model.model_number === 4);
            const sourcePrompt4 = model4Data.source_prompt;
            const targetPrompt4 = model4Data.target_prompt;
            const invfreeResults = await callInvFree(
              imagePairs[imagePairs.length-1]?.main || '',
              sourcePrompt4, 
              targetPrompt4
            );
            return { model: 'InvFree', output: invfreeResults.output };
          })(),

          
          // Model 5: AnyDoor
          (async () => {
            const model5Data = intentModelOutput.selected_models.find((model:SelectedModel) => model.model_number === 5);
          
            if (model5Data && maskData) {
              const anydoorResult = await callAnyDoor(
                baseImageBase64,
                maskData.base_mask,
                refImageBase64,
                maskData.reference_mask
              );
              return { model: 'AnyDoor', output: anydoorResult.output };
            } 
            else{
              return {model: 'AnyDoor', output: null}
            }
          })(),
  
           //Model 6: Paint By Example
          (async () => {
            const model6Data = intentModelOutput.selected_models.find((model:SelectedModel) => model.model_number === 6);
          
            if (model6Data && maskData) {
              const paintResult = await callPaint(
                baseImageBase64,
                maskData.base_mask,
                refImageBase64
              );
              return { model: 'Paint By Example', output: paintResult.output };
            } 
            else{
              return {model: 'Paint By Example', output: null}
            }
          })()
          
          
          
        ];
        
    
        const results = await Promise.all(modelPromises);
    
        results.forEach(({ model, output }) => {
            if(output !== null){
              mockImages[model] = output;
            }

        });
  
        const generationEndTime = performance.now();
        const generationTime = generationEndTime - startTime;
        console.log(`Total time for image generation: ${generationTime.toFixed(2)} ms`);
    
        const conversionStartTime = performance.now();
    
        const uploadPromises = Object.entries(mockImages).map(async ([key, value]) => {
          if (typeof value === 'string' && value.startsWith('data:')) {
            const individualStartTime = performance.now();
            try {
              const uploadedUrl = await uploadBase64(value);
              const individualEndTime = performance.now();
              const conversionTime = individualEndTime - individualStartTime;
              console.log(`Converted ${key} image in ${conversionTime.toFixed(2)} ms`);
              return { key, url: uploadedUrl, conversionTime };
            } catch (error) {
              console.error(`Failed to upload ${key} image:`, error);
              return { key, url: value, conversionTime: 0 };
            }
          }
          return { key, url: value, conversionTime: 0 };
        });
    
        const uploadedResults = await Promise.all(uploadPromises);
        
        let totalConversionTime = 0;
        uploadedResults.forEach(({ key, url, conversionTime }) => {
          mockImages[key]  = url != undefined ? url : '';
          totalConversionTime += conversionTime;
        });
    
        const conversionEndTime = performance.now();
        const overallConversionTime = conversionEndTime - conversionStartTime;
    
        console.log(`Total time for all base64 to URL conversions: ${overallConversionTime.toFixed(2)} ms`);
        console.log(`Sum of individual conversion times: ${totalConversionTime.toFixed(2)} ms`);
    
        console.log("MOCK IMAGES: ", mockImages);
        const modelKeys = Object.keys(mockImages);
        const randomizedOrder = shuffleArray([...modelKeys]);
        setRandomizedModelOrder(randomizedOrder);
        setGeneratedImages(mockImages);
    
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        console.log(`Total time for entire process: ${totalTime.toFixed(2)} ms`);
    
      } catch (error) {
        console.error('Error generating images:', error);
        alert('Failed to generate images. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    };
  
    const handleSelectModel = (model: string) => {
      const selectedImageUrl = generatedImages ? generatedImages[model] : '';
      setSelectedImageUrl(selectedImageUrl);
      setSelectedModel(model);
      setShowConfirmModal(true);
    };

    
  
    const renderSkeletonLoader = () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {[1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} className="relative">
            <div className="w-full h-48 bg-gray-300 rounded-lg animate-pulse "></div>
            <div className="absolute bottom-2 left-2 bg-gray-400 w-16 h-6 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  
    return (
      <div className="mt-6">
        <button 
          onClick={handleGenerate}
          className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300"
          disabled={isGenerating}
          id="generateButton"
        >
          {isGenerating ? 'Generating Images...' : 'Generate Images'}
        </button>
  
        {isGenerating && renderSkeletonLoader()}
  
        {!isGenerating && generatedImages && (
          <div className="mt-4">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Select Best Image:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {randomizedModelOrder.map((model, index) => (
                <div key={model} className="relative">
                  <img 
                    src={generatedImages[model]} 
                    alt={`Generated image`} 
                    className="w-full h-80 object-cover rounded-lg cursor-pointer hover:opacity-75 transition duration-300"
                    onClick={() => handleSelectModel(model)}
                  />
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-sm font-semibold shadow-sm">
                    Model {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleConfirmSelection = (confirmed: boolean) => {
    setShowConfirmModal(false);
    if (confirmed) {
      setImagePairs(prevPairs => {
        const updatedPairs = [...prevPairs];
        updatedPairs[updatedPairs.length - 1] = {
          ...updatedPairs[updatedPairs.length - 1],
          selected: selectedImageUrl + '.selected',
          selectedModel: selectedModel, 
          hyperparams: {
            generationQuality,
            guidanceScale,
            imageInfluence
          }
        };
        
        setOutput(selectedImageUrl);
        
        return updatedPairs;
      });
  
      setCurrentPair(prev => ({
        ...prev,
        main: selectedImageUrl,
        selectedModel: selectedModel, 
        reference: imagePairs.length > 0 ? imagePairs[imagePairs.length - 1].reference : null
      }));
  
      setShowFeedbackForm(true);
    }
  };
  
  

const ConfirmModal: React.FC<ConfirmModalProps> = ({ show, onConfirm, imageUrl }) => {
  if (!show) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white p-8 rounded-xl max-w-2xl w-full relative shadow-2xl">
        <button
          onClick={() => onConfirm(false)}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition-colors duration-200"
          aria-label="Close"
        >
          <X size={24} />
        </button>
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Confirm Your Selection</h2>
        <div className="mb-6 flex justify-center">
          <img src={imageUrl || ''} alt="Selected image" className="max-w-full h-80 object-contain rounded-lg shadow-md" />
        </div>
        <p className="text-center mb-8 text-lg text-gray-600">Are you sure you want to proceed with this image?</p>
        <div className="flex justify-center space-x-6">
          <button
            onClick={() => onConfirm(false)}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-300 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 font-semibold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};


  
  const handleFeedbackSubmit = (feedbackData: FeedbackData) => {
    const currentStep = imagePairs.length - 1;

    setTotalFeedback(prevFeedback => ({
      ...prevFeedback,
      [currentStep]: {
        ...feedbackData,
      }
    }));

    console.log("Feedback submitted:", feedbackData);

    setImagePairs(prevPairs => {
      const updatedPairs = [...prevPairs];
      const lastIndex = updatedPairs.length - 1;
      updatedPairs[lastIndex] = {
        ...updatedPairs[lastIndex],
        selected: currentPair.main,
        selectedModel: selectedModel,  
        generatedImages: generatedImages 
      };

      setOutput(currentPair.main);

      return updatedPairs;
    });

    setCurrentPair(prev => ({ 
      main: prev.main, 
      reference: prev.reference, 
      selected: null, 
      hyperparams: null,
      selectedModel: null, 
      generatedImages: null
    }));

    setMaskData(null);
    setPromptModel(false);
    setGeneratedImages(null);
    setSelectedModel(null);
    setShowFeedbackForm(false);
  };

  const FeedbackForm: React.FC<FeedbackFormProps> = ({ 
    generatedImages, 
    selectedModel, 
    onSubmit,
    randomizedOrder,
    baseImage,
    referenceImage
  }) => {
    const [activeTab, setActiveTab] = useState(selectedModel);
    const [feedbackState, setFeedbackState] = useState<FeedbackData>(() => {
      const initialState: FeedbackData = {};
      Object.keys(generatedImages).forEach((model) => {
        initialState[model] = {
          imageQuality: 3,
          followsInstructions: 3,
          matchesOriginal: 3,
          culturalRelevance: 3,
          offensiveContent: false,
          offensiveContentDescription: "",
          isNatural: false,
          detailedThoughts: "",
        };
      });
      return initialState;
    });

    const renderImageComparison = (model: string, index: number) => (
      <div className="space-y-6">
        <div className="bg-gray-50 p-6 rounded-xl shadow-lg">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Output Image</h4>
          <div className="relative w-full aspect-video">
            <img
              src={generatedImages[model]}
              alt={`Generated image from Model ${index + 1}`}
              className="w-full h-full object-contain rounded-lg"
              title={`Generated image from Model ${index + 1}`}
            />
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Base Image</h4>
              <div className="relative w-full aspect-video">
                <Image
                  src={baseImage || ''}
                  alt="Base Image"
                  layout="fill"
                  objectFit="contain"
                  className="rounded-lg"
                />
              </div>
            </div>
            {referenceImage && (
              <div>
                <h4 className="text-lg font-semibold mb-3 text-gray-800">Reference Image</h4>
                <div className="relative w-full aspect-video">
                  <Image
                    src={referenceImage}
                    alt="Reference Image"
                    layout="fill"
                    objectFit="contain"
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    const handleFeedbackChange = (model: string, field: keyof FeedbackData[string], value: number | string | boolean) => {
      setFeedbackState((prev) => ({
        ...prev,
        [model]: {
          ...prev[model],
          [field]: value,
          ...(field === 'offensiveContent' && value === false ? { offensiveContentDescription: "" } : {}),
        },
      }));
    };
  
    const handleSubmit = () => {  
      onSubmit(feedbackState);
    };

    const getRatingLabels = (field: keyof FeedbackData[string]): { min: string; max: string } => {
      const labels: Record<keyof FeedbackData[string], { min: string; max: string } | undefined> = {
        imageQuality: {
          min: "Not likely",
          max: "Very likely"
        },
        followsInstructions: {
          min: "Does not follow",
          max: "Follows perfectly"
        },
        matchesOriginal: {
          min: "Does not maintain",
          max: "Maintains perfectly"
        },
        culturalRelevance: {
          min: "Does not reflect target culture",
          max: "Perfectly reflects"
        },
        offensiveContent: undefined,
        offensiveContentDescription: undefined,
        isNatural: undefined,
        detailedThoughts: undefined
      };
      
      return labels[field] || { min: "1", max: "5" };
    };
      
    const renderRatingSlider = (model: string, field: keyof FeedbackData[string], question: string, label_description: string) => {
      const labels = getRatingLabels(field);
      
      return (
        <div className="mb-8 bg-gray-50 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
          <label className="block text-base font-semibold text-gray-800 mb-3" title={question}>
            {question}
            <span className="block text-sm font-normal text-gray-500 mt-1">
              {label_description}
            </span>
          </label>
          <div className="relative pt-2 pb-6">
            <input
              type="range"
              min={1}
              max={5}
              value={feedbackState[model][field] as number}
              onChange={(e) => handleFeedbackChange(model, field, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              step="1"
              title={`Rate the ${field} for model ${model}`}
            />
            <div className="absolute w-full" style={{ top: '2rem' }}>
              <div className="relative w-full flex">
                <div className="absolute w-full flex justify-between px-1.5">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div 
                      key={num} 
                      className="flex flex-col items-center"
                      style={{ width: '20px' }}
                    >
                      <span 
                        className={`text-sm font-medium ${
                          feedbackState[model][field] === num 
                            ? 'text-blue-600' 
                            : 'text-gray-400'
                        }`}
                      >
                        {num}
                      </span>
                      {(num === 1 || num === 5) && (
                        <span className="text-xs text-gray-500 mt-1 text-center w-20">
                          {num === 1 ? labels.min : labels.max}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-11/12 max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">
              Model Output Feedback
            </h2>
            <button
              onClick={() => setShowFeedbackForm(false)}
              className="text-white hover:text-red-100 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-gray-50 border-b border-gray-200 px-4 py-8">
            <div className="flex justify-center gap-2">
              {randomizedModelOrder.map((model, index) => (
                <button
                  key={model}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === model
                      ? "bg-blue-500 text-white shadow-lg scale-105"
                      : "bg-white text-gray-600 hover:bg-gray-100 shadow-sm"
                  }`}
                  onClick={() => setActiveTab(model)}
                  title={`Switch to feedback for Model ${index + 1}`}
                >
                  Model {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-grow" style={{ maxHeight: 'calc(80vh - 180px)' }}>
            {randomizedModelOrder.map((model, index) => (
              <div
                key={model}
                className={`${activeTab === model ? "block" : "hidden"} space-y-8 p-6`}
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-1/2">
                    {renderImageComparison(model, index)}
                  </div>

                  <div className="lg:w-1/2 space-y-6">
                    {renderRatingSlider(
                      model,
                      "imageQuality",
                      "Image Quality",
                      "How likely are you to use this image in professional settings such as advertisements, educational content, etc..."
                    )}
                    {renderRatingSlider(
                      model,
                      "followsInstructions",
                      "Instruction Adherence",
                      "Evaluate how well the image follows the given instructions"
                    )}
                    {renderRatingSlider(
                      model,
                      "matchesOriginal",
                      "Original Image Similarity",
                      "Rate how well the edit maintains the original image's essence"
                    )}
                    {renderRatingSlider(
                      model,
                      "culturalRelevance",
                      "Cultural Accuracy",
                      "Assess how well the image reflects the target culture"
                    )}

                    <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={feedbackState[model].offensiveContent}
                          onChange={(e) => handleFeedbackChange(model, "offensiveContent", e.target.checked)}
                          className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-700 font-medium">Contains potentially offensive content</span>
                      </label>
                        
                      <AnimatePresence>
                        {feedbackState[model].offensiveContent && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4"
                          >
                            <textarea
                              value={feedbackState[model].offensiveContentDescription}
                              placeholder="Please describe the offensive content..."
                              onChange={(e) => handleFeedbackChange(model, "offensiveContentDescription", e.target.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={3}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={feedbackState[model].isNatural}
                          onChange={(e) => handleFeedbackChange(model, "isNatural", e.target.checked)}
                          className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-700 font-medium">Does the image look natural?</span>
                      </label>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                      <label className="block text-gray-700 font-medium mb-2">
                        Additional Thoughts
                      </label>
                      <textarea
                        placeholder="Share any additional feedback about the generated image..."
                        value={feedbackState[model].detailedThoughts}
                        onChange={(e) => handleFeedbackChange(model, "detailedThoughts", e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-4 bg-white sticky bottom-0">
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-600 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      </div>
    );
  };

    const renderPrompt = () => {
      return (
        <div id="promptDisplay" className="bg-white p-4 mt-4 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Prompt</h3>
          <div className="mb-4">
            <p className="text-sm text-gray-700">
              {prompt ? prompt : "No prompt entered yet."}
            </p>
          </div>
        </div>
      );
    };
  

  const renderPreferences = () => {
    return (
      <div id="preferences" className="bg-white p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Preferences</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" title="Adjust the generation quality between quick and high quality">Generation Quality</label>
          <input
            type="range"
            min="1"
            max="100"
            value={generationQuality}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              setGenerationQuality(newValue);
              setGenerationQualityScale(newValue / 30);
            }}
            className="range range-primary [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-ms-thumb]:bg-white"
            step="1"
            title="Move the slider to adjust the generation quality"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span title="Quick Generation">Quick Generation</span>
            <span title="Quality Generation">Quality Generation</span>
          </div>
        </div>

        

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" title="Adjust the guidance scale">Text Influence</label>
          <input
            type="range"
            min="0.1"
            max="30"
            step="0.1"
            value={guidanceScale}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              setGuidanceScale(newValue);
              setGuidanceScaleScale(newValue / 7.5);
            }}
            className="range range-primary [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-ms-thumb]:bg-white"
            title="Move the slider to adjust the text influence"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span title="More Creative">More Creative</span>
            <span title="More Focused">More Focused</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" title="Adjust the image influence level">Image Influence</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={imageInfluence}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              setImageInfluence(newValue);
              setImageInfluenceScale(newValue / 1.0);
            }}
            className="range range-primary [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:bg-white [&::-ms-thumb]:bg-white"
            title="Move the slider to adjust the image influence"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span title="Less Influence">Less Influence</span>
            <span title="More Influence">More Influence</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen max-w-screen bg-gray-100 overflow-x-hidden">
      <div className="w-1/5 bg-white border-r border-gray-300 overflow-y-auto">
        <div className="text-8xl flex h-[70px]"></div>

        <h2 id="stepsHeader" className="text-xl  font-semibold mb-4 text-blue-600 text-center p-4 border-b border-gray-300 ">Steps</h2>
        <div ref={stepsRef}>
          {imagePairs.map((pair, index) => (
            <div
              className="collapse collapse-arrow bg-white hover:bg-gray-100 transition-colors duration-300"
              key={index}
            >
              <input
                title="Steps Checkbox"
                type="checkbox"
                id={`accordion-item-${index}`}
                className="peer"
            
                defaultChecked={index === accordionIndex}
              />
              <div className="collapse-title text-xl font-medium text-black">
                {`Step ${index + 1}`}
              </div>
              <div className="collapse-content text-black">
                {renderStep(pair, index)}
              </div>
            </div>
          ))}
        </div>
      </div>


      <div className="flex-grow p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Image Transcreation Platform</h1>

        <div className="mb-8">
          <div id="uploadArea" className="flex flex-col md:flex-row justify-between mb-4">
            {renderUploadArea('main')}
            {!promptModel && renderUploadArea('reference')}
          </div>

          {(!maskData && !promptModel) && (
            <>
              <Placeholder
                prompt={prompt}
                setPrompt={setPrompt}
                handleAddStep={handleAddStep}
              />
             
              <div className="flex justify-between items-start mt-4 space-x-8">
                
                <div id="inputResult" className="w-1/3 rounded-2xl bg-white shadow-xl transition-all duration-300 hover:shadow-2xl border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
                      Input Image
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Original uploaded image</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 border border-gray-100 group">
                      {inputImage ? (
                        <>
                          <Image
                            src={inputImage}
                            alt="Input Image"
                            layout="fill"
                            objectFit="contain"
                            className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400 transition-transform duration-300 transform group-hover:scale-105">
                          <svg 
                            className="w-16 h-16 mb-4 opacity-50" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="1.5" 
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-sm font-medium">No input image</span>
                          <span className="text-xs mt-2 text-gray-400">Upload an image to begin</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                
                <div id="outputResult" className="w-1/3 rounded-2xl bg-white shadow-xl transition-all duration-300 hover:shadow-2xl border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
                      Output Image
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Generated result</p>
                  </div>
                  
                  <div className="p-6">
                    <div className="relative w-full h-80 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 border border-gray-100 group">
                      {outputImage ? (
                        <>
                          <Image
                            src={outputImage}
                            alt="Output Image"
                            layout="fill"
                            objectFit="contain"
                            className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                          
                          
                          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button 
                              onClick={() => window.open(outputImage, '_blank')}
                              className="bg-white/90 hover:bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-300 flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span className="text-sm font-medium">View Full</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400 transition-transform duration-300 transform group-hover:scale-105">
                          <svg 
                            className="w-16 h-16 mb-4 opacity-50" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="1.5" 
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          <span className="text-sm font-medium">No output image</span>
                          <span className="text-xs mt-2 text-gray-400">Generated image will appear here</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <PublishForm
                  id="feedback"
                  inputImage={inputImage}
                  outputImage={outputImage}
                  email={email}
                  imagePairs={imagePairs}
                  totalFeedback={totalFeedback}
                  prompts={prompts}
                  reset={resetPageAfterPublish}
                />
              </div>
            </>
          )}

          {(maskData || promptModel) && renderPreferences()}
          {(maskData || promptModel) && renderPrompt()}
          {(maskData || promptModel) && renderGenerate()}
        </div>

        {showAlert && (
          <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[200] w-1/2 flex justify-center animate-pop-bounce">
            {alertMessage}
          </div>
        )}
      </div>

      {showConfirmationPage && <ConfirmationPage />}

      {showCanvas && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="relative w-4/5 h-4/5">
            <button
              onClick={handleBack}
              className="absolute top-6 right-6 z-10 text-white bg-none hover:text-red-600 rounded-full w-8 h-8 flex items-center justify-center"
              title="Go back"
            >
              <X size={25} />
            </button>
            {(() => {
              const baseUrl = encodeURIComponent(imagePairs[imagePairs.length - 1].main || '');
              const referenceUrl = encodeURIComponent(imagePairs[imagePairs.length - 1].reference || '');
              const emailEncoded = encodeURIComponent(email);
              fullUrl = `${process.env.NEXT_PUBLIC_STREAMLIT_APP}?base_url=${baseUrl}&reference_url=${referenceUrl}&email=${emailEncoded}&embedded=true`;
              console.log('Constructed URL:', fullUrl);
              return "";
            })()}
            
            <iframe
              title="canvas-frame"
              src={fullUrl}
              width="100%"
              height="100%"
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full rounded-2xl"
            ></iframe>
          </div>
        </div>
      )}

  {showConfirmModal && (
    <ConfirmModal
      show={showConfirmModal}
      onConfirm={handleConfirmSelection}
      imageUrl={selectedImageUrl}
    />
  )}

  {showFeedbackForm && (
    <FeedbackForm
      generatedImages={generatedImages || {}}
      selectedModel={selectedModel || ''}
      onSubmit={handleFeedbackSubmit}
      randomizedOrder={randomizedModelOrder}
      baseImage={imagePairs[imagePairs.length - 1]?.main || null}
      referenceImage={imagePairs[imagePairs.length - 1]?.reference || null}
    />
  )}
    </div>
  );
}
