"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle } from 'lucide-react';
import { useUser } from "@/contexts/UserContext";

const FeedbackForm = () => {
  const [formData, setFormData] = useState({
    rating: 5,
    category: '',
    comment: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user } = useUser();

  const handleSubmit = async (e : any) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/submit-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          email: user?.email,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setFormData({ rating: 5, category: '', comment: '' });
      } else {
        throw new Error('Submission failed');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white font-sans py-24">
      <div className="max-w-2xl mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600"
        >
          Share Your Feedback
        </motion.h1>

        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white bg-opacity-10 rounded-xl p-8 text-center"
          >
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-4">Thank You!</h2>
            <p className="text-gray-200 mb-6">Your feedback has been submitted successfully.</p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-full"
            >
              Submit Another Response
            </button>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white bg-opacity-10 rounded-xl p-8"
            onSubmit={handleSubmit}
          >
            <div className="mb-6">
              <label className="block text-lg mb-2">How would you rate your experience?</label>
              <div className="flex justify-between items-center">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: value })}
                    className={`mt-6 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                      formData.rating === value
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 scale-110'
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-lg mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full bg-white bg-opacity-20 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="" disabled className='text-black'>Select a category</option>
                <option value="ui" className='text-black'>UI/UX</option>
                <option value="models" className='text-black' >Models</option>
                <option value="bugs" className='text-black' >Bugs</option>
                <option value="improvements" className='text-black'>Improvements</option>
                <option value="other" className='text-black'>Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-lg mb-2">Your Feedback</label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                required
                rows={4}
                className="w-full bg-white bg-opacity-20 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Tell us what you think..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-4 rounded-full flex items-center justify-center transition duration-300 disabled:opacity-50"
            >
              {isSubmitting ? (
                'Submitting...'
              ) : (
                <>
                  Submit Feedback
                  <Send className="ml-2 w-5 h-5" />
                </>
              )}
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
};

export default FeedbackForm;