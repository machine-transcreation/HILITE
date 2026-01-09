import Image from "next/image";
import { useState } from "react";

export function ImageModal({ isOpen, onClose, inputImage, outputImage, title, steps, prompts, fromCulture, toCulture, application }) {
  const [showFullHistory, setShowFullHistory] = useState(false);

  if (!isOpen) return null;

  const FullHistory = () => (
    <div className="z-20 bg-white p-8 rounded-lg max-w-6xl w-full mx-4 my-8 animate-scaleIn overflow-y-auto max-h-[90vh] shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">{title} - Full History</h2>
        <button 
          onClick={() => setShowFullHistory(false)}
          className="text-3xl font-bold text-gray-500 hover:text-gray-700 transition-colors"
        >
          &times;
        </button>
      </div>
      
      <div className="mb-8 bg-gray-100 p-6 rounded-lg shadow-md">
        <h3 className="text-2xl font-semibold mb-4 text-gray-700">Translation Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-md shadow">
            <p><span className="font-semibold text-gray-600">Base Country:</span> <span className="text-gray-800">{fromCulture}</span></p>
            <p><span className="font-semibold text-gray-600">Target Country:</span> <span className="text-gray-800">{toCulture}</span></p>
          </div>
          <div className="bg-white p-4 rounded-md shadow">
            <p><span className="font-semibold text-gray-600">Application:</span> <span className="text-gray-800">{application}</span></p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6 text-gray-700">Translation Steps</h3>
        {steps.map((step, index) => (
          <div key={index} className="mb-10 p-6 bg-gray-50 rounded-lg shadow-lg">
            <h4 className="text-xl font-semibold mb-4 text-gray-700">Step {index + 1}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-4 rounded-md shadow">
                <p className="font-medium text-gray-600 mb-2">Base Image</p>
                <div className="relative h-[200px]">
                  <Image src={step.main} alt={`Step ${index + 1} Main`} layout="fill" objectFit="contain" />
                </div>
              </div>
              {step.reference && (
                <div className="bg-white p-4 rounded-md shadow">
                  <p className="font-medium text-gray-600 mb-2">Reference Image</p>
                  <div className="relative h-[200px]">
                    <Image src={step.reference} alt={`Step ${index + 1} Reference`} layout="fill" objectFit="contain" />
                  </div>
                </div>
              )}
              <div className="bg-white p-4 rounded-md shadow">
                <p className="font-medium text-gray-600 mb-2">Selected Image</p>
                <div className="relative h-[200px]">
                  <Image src={step.selected} alt={`Step ${index + 1} Selected`} layout="fill" objectFit="contain" />
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-md shadow mb-4">
              <p className="font-medium text-gray-600 mb-2">Prompt:</p>
              <p className="text-gray-800">{prompts[index]}</p>
            </div>
            <div className="bg-white p-4 rounded-md shadow">
              <p className="font-medium text-gray-600 mb-2">Hyperparameters:</p>
              <ul className="list-disc list-inside text-gray-800">
              {Object.entries(step.hyperparams).map(([key, value]) => {

              const labels = {
                generationQuality: "Generation Quality",
                controlStrength: "Control Strength",
                guidanceScale: "Guidance Scale",
                imageInfluence: "Image Influence"
              };
      
     
                return (
                  <li key={key}>
                    <span className="font-medium">
                      {labels[key] || key}:
                    </span> {value}
                  </li>
                );
              })}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] animate-fadeIn overflow-y-auto">
      {!showFullHistory ? (
        <div className="bg-white p-8 rounded-lg max-w-4xl w-full mx-4 animate-scaleIn shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
            <button 
              onClick={onClose}
              className="text-3xl font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
              &times;
            </button>
          </div>
          <div className="flex flex-col md:flex-row justify-center items-center gap-8">
            <div className="w-full md:w-1/2 relative">
              <div className="relative h-[300px]">
                <Image 
                  src={inputImage}
                  alt="Input image"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
              <div className="text-gray-700 text-center py-3 font-medium">
                Before Translation
              </div>
            </div>
            <div className="w-full md:w-1/2 relative">
              <div className="relative h-[300px]">
                <Image 
                  src={outputImage}
                  alt="Output image"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
              <div className="text-gray-700 text-center py-3 font-medium">
                After Translation
              </div>
            </div>
          </div>
          <div className="mt-8 text-center">
            <button 
              onClick={() => setShowFullHistory(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
              View Full History
            </button>
          </div>
        </div>
      ) : (
        <FullHistory />
      )}
    </div>
  );
}