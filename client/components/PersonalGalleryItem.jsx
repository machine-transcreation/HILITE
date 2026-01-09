import { ImageModal } from "@/components/ImageModal";
import formatDate from "@/utils/formatDate";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import Image from "next/image";
import { useState } from "react";

export function PersonalGalleryItem({ imageData, userData, onDelete, imageId, title, date}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = async () => {
    onDelete(imageId);

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/delete-image/${imageId}`);
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  const handleItemClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div 
        className="w-[340px] h-[240px] rounded overflow-hidden shadow-lg m-4 transition-transform duration-500 transform hover:bg-gray-100 relative cursor-pointer"
        onClick={handleItemClick}
      >
        {title && (
          <div className="absolute top-0 left-0 z-50 max-w-[50%] overflow-hidden">
            <div className="bg-white text-black px-2 py-1 m-2 rounded shadow-md text-xs truncate">
              {title}
            </div>
          </div>
        )}
        <div 
          className="text-xs absolute top-0 right-0 text-white px-2 py-1 m-2 rounded shadow-md z-50 cursor-pointer hover:text-red-600 transition-colors duration-200"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </div>
        <div className="text-xs absolute top-8 left-0 text-white px-2 py-1 m-2 rounded shadow-md z-50">
          Private
        </div>
        <div className="flex justify-center">
          <div className="w-[170px] h-[170px] relative overflow-hidden">
            <Image 
              src={imageData.inputImage}
              alt="Input image"
              layout="fill"
              objectFit="cover"
              objectPosition="center"
            />
          </div>
          <div className="w-[170px] h-[170px] relative overflow-hidden">
            <Image 
              src={imageData.outputImage} 
              alt="Output image"
              layout="fill"
              objectFit="cover"
              objectPosition="center"
            />
          </div>
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-[50px] h-[50px] relative overflow-hidden rounded-full mr-4">
              <Image 
                src={userData.picture} 
                alt={userData.name}
                layout="fill"
                objectFit="cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="font-bold text-lg truncate">{userData.name}</div>
              <div className="text-xs">
                {formatDate(date)} 
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        inputImage={imageData.inputImage}
        outputImage={imageData.outputImage}
      />
    </>
  );
}
