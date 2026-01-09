"use client";
import GalleryItem from '@/components/GalleryItem';
import { useUser } from "@/contexts/UserContext";
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type EditsData = {
  _id: string;
  title: string; 
  imageData: string;
  userData: string;
  likes: number;
  date: string;
  visibility: "public" | "private";
};

export default function EditsPage() {
  const [editsData, setEditsData] = useState<EditsData[]>([]);
  const [filteredEdits, setFilteredEdits] = useState<EditsData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterOption, setFilterOption] = useState<string>("Filter by Date");
  const { user } = useUser();

  useEffect(() => {
    async function fetchAndFilterEditsData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get<EditsData[]>(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/edits/${user.email}`);
        const edits = response.data;

        setEditsData(edits);
        filterAndSetEdits(edits, searchTerm, filterOption);
      } catch (err) {
        console.error("Error fetching edits data:", err);
        setError("Failed to fetch your edits. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchAndFilterEditsData();
  }, [user]);

  useEffect(() => {
    if (editsData.length > 0) {
      filterAndSetEdits(editsData, searchTerm, filterOption);
    }
  }, [searchTerm, filterOption, editsData]);

  const filterAndSetEdits = (edits: EditsData[], searchTerm: string, filterOption: string) => {
    const filtered = edits
      .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(item => {
        if (filterOption === "Filter by Date") return true;
        if (filterOption === "Filter Private") return item.visibility === "private";
        if (filterOption === "Filter Public") return item.visibility === "public";
        return true;
      });

    setFilteredEdits(filtered.reverse());
  };

  const handleDelete = (imageId: string) => {
    const updatedEditsData = editsData.filter(item => item._id !== imageId);
    setEditsData(updatedEditsData);
    filterAndSetEdits(updatedEditsData, searchTerm, filterOption);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDropdownChange = (option: string) => {
    setFilterOption(option);
  };

  if (loading) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-gray-600 border-t-transparent rounded-full"
        />
        <p className="mt-4 text-gray-700 font-semibold">Loading your edits...</p>
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

  if (!user) {
    return (
      <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center">
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl text-gray-800 font-bold"
        >
          Please sign in to view your edits.
        </motion.p>
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
          My Edits
        </motion.h1>

        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search edits..."
              className="bg-white pl-10 pr-4 py-2 w-full sm:w-64 rounded-full border-2 border-gray-300 focus:border-gray-500 focus:ring focus:ring-gray-200 focus:ring-opacity-50"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>

          <div className="relative inline-block text-left">
            <select
              title="date"
              className="appearance-none bg-white border-2 border-gray-300 rounded-full py-2 pl-4 pr-8 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              value={filterOption}
              onChange={(e) => handleDropdownChange(e.target.value)}
            >
              <option>Filter by Date</option>
              <option>Filter Private</option>
              <option>Filter Public</option>
            </select>
            <SlidersHorizontal className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          </div>
        </div>

        {filteredEdits.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center text-xl text-gray-600"
          >
            No edits found. Try adjusting your search or filter.
          </motion.p>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredEdits.map((item, index) => (
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
                  mode="personal"
                  visibility={item.visibility}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
