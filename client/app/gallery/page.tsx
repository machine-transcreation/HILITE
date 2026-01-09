"use client";
import GalleryItem from '@/components/GalleryItem';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type GalleryData = {
  _id: string;
  title: string;
  imageData: {
    inputImage: string;
    outputImage: string;
    steps: string[];
    prompts: string[];
    fromCulture: string;
    toCulture: string;
    application: string;
  };
  userData: {
    name?: string;
    email?: string;
  };
  likes: number; 
  date: string;
};

export default function GalleryPage() {
  const [galleryData, setGalleryData] = useState<GalleryData[]>([]);
  const [filteredGallery, setFilteredGallery] = useState<GalleryData[]>([]);
  const [displayedGallery, setDisplayedGallery] = useState<GalleryData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterOption, setFilterOption] = useState<string>("Filter by Likes");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    async function fetchGalleryData() {
      try {
        const response = await axios.get<GalleryData[]>(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/gallery`);
        setGalleryData(response.data);
        filterGallery(response.data, searchTerm, filterOption);
      } catch (error) {
        setError("Failed to fetch gallery data.");
      }
      setLoading(false);
    }

    fetchGalleryData();
  }, []);

  useEffect(() => {
    if (galleryData.length > 0) {
      filterGallery(galleryData, searchTerm, filterOption);
    }
  }, [searchTerm, filterOption, galleryData]);

  useEffect(() => {
  
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setDisplayedGallery(filteredGallery.slice(startIndex, endIndex));
  }, [filteredGallery, currentPage]);

  const filterGallery = (data: GalleryData[], searchTerm: string, filterOption: string) => {
    
    let filtered = data.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.userData?.name && item.userData.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.userData?.email && item.userData.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterOption === "Filter by Likes") {
      filtered = filtered.sort((a, b) => b.likes - a.likes);
    } else if (filterOption === "Filter by Date") {
      filtered = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    setFilteredGallery(filtered);
    setCurrentPage(1); 
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDropdownChange = (option: string) => {
    setFilterOption(option);
  };

  const totalPages = Math.ceil(filteredGallery.length / ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-gray-600 border-t-transparent rounded-full"
        />
        <p className="mt-4 text-gray-700 font-semibold">Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl text-gray-800 font-bold"
        >
          {error}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="h-[10vh] flex"></div>
      <div className="max-w-7xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl text-center text-gray-900 mb-8"
        >
          Gallery
        </motion.h1>

        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Title, Name, or Email"
              className="bg-white pl-10 pr-4 py-2 w-full sm:w-64 rounded-full border-2 border-gray-300 focus:border-gray-500 focus:ring focus:ring-gray-200 focus:ring-opacity-50"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>

          <div className="relative inline-block text-left">
            <select
              title="likes"
              className="appearance-none bg-white border-2 border-gray-300 rounded-full py-2 pl-4 pr-8 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              value={filterOption}
              onChange={(e) => handleDropdownChange(e.target.value)}
            >
              <option>Filter by Likes</option>
              <option>Filter by Date</option>
            </select>
            <SlidersHorizontal className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          </div>
        </div>

        {filteredGallery.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center text-xl text-gray-600"
          >
            No translations found. Try adjusting your search.
          </motion.p>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8"
            >
              {displayedGallery.map((item, index) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <GalleryItem
                    imageId={item._id}
                    imageData={item.imageData}
                    userData={item.userData}
                    likes={item.likes}
                    title={item.title}
                    date={item.date}
                    mode="gallery"
                    visibility="public"
                    onDelete={''}
                  />
                </motion.div>
              ))}
            </motion.div>

            
            <div className="flex justify-center items-center space-x-4 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-full bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft />
              </button>

              <span className="text-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-full bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}