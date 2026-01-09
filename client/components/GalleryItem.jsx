import { ImageModal } from "@/components/ImageModal";
import { useUser } from "@/contexts/UserContext";
import formatDate from "@/utils/formatDate";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function GalleryItem({
  imageData,
  userData, 
  likes,
  title,
  date,
  mode,
  visibility,
  onDelete,
  imageId,
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [totalLikes, setTotalLikes] = useState(likes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(true);
  const { user } = useUser();
  const email = user?.email || '';

  useEffect(() => {
    const fetchLikeStatus = async () => {
      setIsLikeLoading(true);
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/check-like/${imageId}/${email}`);
        setIsLiked(response.data.liked);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.error("Image not found");
        } else {
          console.error("Error fetching like status:", err);
        }
      } finally {
        setIsLikeLoading(false);
      }
    };
  
    if (imageId && email) {
      fetchLikeStatus();
    }
  }, [imageId, email]);

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (isLiked) {
      setTotalLikes(totalLikes - 1);
    } else {
      setTotalLikes(totalLikes + 1);
    }
    
    setIsLiked(!isLiked);
    
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/like-image`, { 
        imageId, 
        userEmail: email 
      });
      
      setIsLiked(response.data.isLiked);
      setTotalLikes(response.data.likes);
    } catch (err) {
      console.error("Error liking image:", err);
    }
  };

  const handleItemClick = () => {
    setIsModalOpen(true);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    onDelete(imageId);
    setIsDeleteModalOpen(false);

    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/delete-image/${imageId}`);
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  return (
    <>
      <div
        className="relative w-[400px] h-[250px] rounded-lg overflow-hidden shadow-lg m-4 cursor-pointer flex transform transition-transform duration-300 hover:scale-105"
        onClick={handleItemClick}
      >
        {mode === 'personal' && (
          <>
            <div
              className="text-xs absolute top-0 right-0 text-white p-2 m-2 rounded shadow-md z-20 cursor-pointer hover:text-red-600 transition-colors duration-200"
              onClick={handleDeleteClick}
            >
              <FontAwesomeIcon icon={faTrash} size="lg" />
            </div>
            <div className="text-xs absolute top-8 left-0 text-white px-2 py-1 m-2 rounded shadow-md z-50 drop-shadow-lg">
              {visibility.charAt(0).toUpperCase() + visibility.slice(1)}
            </div>
          </>
        )}
        <div className="w-1/2 h-full relative">
          <Image
            src={imageData.inputImage}
            alt="Input image"
            layout="fill"
            objectFit="cover"
            className="z-0"
          />
        </div>
        <div className="w-1/2 h-full relative">
          <Image
            src={imageData.outputImage}
            alt="Output image"
            layout="fill"
            objectFit="cover"
            className="z-0"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent z-10" />

        <div className="absolute top-4 left-4 z-10 max-w-[80%] drop-shadow-lg">
          <h3 className="text-white text-lg font-bold truncate">{title}</h3>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center drop-shadow-lg">
            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
              <Image
                src={userData.picture}
                alt={userData.name}
                width={40}
                height={40}
                objectFit="cover"
              />
            </div>
            <div>
              <p className="text-white font-semibold">{userData.name}</p>
              <p className="text-white/80 text-sm">{formatDate(date)}</p>
            </div>
          </div>
          {visibility !== 'private' && (
            <button
              className="flex items-center text-white/80 hover:text-white transition-colors"
              onClick={handleLikeClick}
            >
              {isLikeLoading ? (
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  <svg
                    className={`w-8 h-8 ${isLiked ? "text-red-500 fill-current" : "text-white stroke-current"}`}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <span className="ml-2 w-4">{totalLikes}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <ImageModal
        className="z-[60]"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        inputImage={imageData.inputImage}
        outputImage={imageData.outputImage}
        title={title}
        steps={imageData.steps}
        prompts={imageData.prompts}
        fromCulture={imageData.fromCulture}
        toCulture={imageData.toCulture}
        application={imageData.application}
      />

      {isDeleteModalOpen && (
        <dialog id="delete_modal" className={`modal modal-open`}>
          <div className="modal-box">
            <form method="dialog">
              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                ✕
              </button>
            </form>
            <h3 className="font-bold text-lg">Confirm Delete</h3>
            <p className="py-4">Are you sure you want to delete this item?</p>
            <div className="modal-action">
              <button className="btn" onClick={handleConfirmDelete}>
                Confirm
              </button>
              <button className="btn btn-ghost" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
