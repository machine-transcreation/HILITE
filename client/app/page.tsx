"use client";
import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from "@react-oauth/google";
import { useUser } from "@/contexts/UserContext";

const Home: React.FC = () => {
  const instructionsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { login, user, logout } = useUser();


  const scrollToInstructions = () => {
    instructionsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const onPlatformClick = () => {
    if (user) {
      router.push('/platform');
    }
   
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log("Login successful", tokenResponse);
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
        .then(response => response.json())
        .then(userInfo => {
          const userData = {
            email: userInfo.email,
            family_name: userInfo.family_name,
            given_name: userInfo.given_name,
            name: userInfo.name,
            picture: userInfo.picture
          };
          login(userData);

          fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/add`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
          })
            .then(response => {
              if (response.ok) {
                return response.json();
              } else {
                throw new Error("Failed to add user to database");
              }
            })
            .then(data => {
              console.log("User added to database:", data);
            })
            .catch(error => {
              console.error("Error adding user:", error);
            });
        })
        .catch(error => {
          console.error("Error fetching user info:", error);
        });
    },
    onError: () => {
      console.log("Login Failed");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white font-sans">
      <LandingSection onContinue={scrollToInstructions} onLogin={googleLogin} user={user} logout={logout} />
      <InstructionsSection ref={instructionsRef} onLogin={googleLogin} onPlatformClick={onPlatformClick} />
    </div>
  );
};

const LandingSection: React.FC<{ onContinue: () => void; onLogin: () => void; user: any; logout: () => void }> = ({ onContinue, onLogin, user, logout }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-4">
    <motion.h1
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className="text-7xl font-extrabold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600"
    >
      HIL<span className="text-pink-500">ITE</span>
    </motion.h1>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.5 }}
      className="text-2xl mb-12 text-center max-w-2xl text-gray-300 font-light"
    >
      Human-in-the-loop interactive tool for standardizing cultural image translations
    </motion.p>
    <div className="flex gap-4">
      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        onClick={onContinue}
        className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full flex items-center transition duration-300 text-lg shadow-lg hover:shadow-xl"
      >
        Explore<ArrowRight className="ml-2" />
      </motion.button>
      {user ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          onClick={logout}
          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 px-8 rounded-full flex items-center transition duration-300 text-lg shadow-lg hover:shadow-xl"
        >
          Sign out
        </motion.button>
      ) : (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          onClick={onLogin}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-full flex items-center transition duration-300 text-lg shadow-lg hover:shadow-xl"
        >
          Sign in
        </motion.button>
      )}
    </div>
  </div>
);

const InstructionsSection = React.forwardRef<HTMLDivElement, { onLogin: () => void; onPlatformClick: () => void }>((props, ref) => (
  <div ref={ref} className="min-h-screen py-16 bg-black bg-opacity-30 backdrop-blur-md">
    <div className="max-w-4xl mx-auto px-4">
      <h1 className="text-5xl font-bold mb-12 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Cultural Image Translation Platform</h1>
      
      <Section title="Who are we?" icon={<Users className="w-8 h-8 text-pink-500" />}>
        <p className="text-lg leading-relaxed">
          We're a passionate team of researchers from OpenNLP Labs, driven by the vision of revolutionizing cultural image generation. Our cutting-edge platform tackles the intricate challenge of translating images across cultures with precision and creativity - one thoughtful edit at a time.
        </p>
      </Section>

      <Section title="Why choose us?" icon={<CheckCircle className="w-8 h-8 text-green-400" />}>
        <ul className="list-none space-y-4">
          {[
            "State-of-the-art diffusion models at your fingertips",
            "Seamless image sharing and collaboration",
            "Backed by top-tier research from CMU and Stanford"
          ].map((item, index) => (
            <li key={index} className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
              <span className="text-lg">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How to use HILITE" icon={<Zap className="w-8 h-8 text-yellow-400" />}>
        <ol className="list-none space-y-6 mt-4">
          {[
            <span key="login">
              <span className="cursor-pointer text-blue-400 hover:underline" onClick={props.onLogin}>Sign in</span> to your account
            </span>,
            <span key="platform">
              Open the interactive <span className="cursor-pointer text-blue-400 hover:underline" onClick={props.onPlatformClick}>platform</span>
            </span>,
            "Upload your base image and an optional reference image",
            "Craft your cultural translation prompt",
            "Apply masks and fine-tune your edits",
            "Select source and target cultures",
            "Save and share your culturally translated masterpiece!"
          ].map((step, index) => (
            <li key={index} className="flex items-start">
              <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0 font-bold">{index + 1}</span>
              <span className="text-lg">{step}</span>
            </li>
          ))}
        </ol>
      </Section>
      {/*}  
      <div className="mt-16">
        <h3 className="text-3xl font-semibold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-600">Onboarding Video</h3>
        <div className="relative">
          <img src="/assets/nature1.jpg" alt="Example output" className="w-full rounded-lg shadow-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60 rounded-lg"></div>
          <p className="absolute bottom-4 left-4 right-4 text-white text-lg font-semibold text-center">Experience the seamless blend of cultures through our advanced AI</p>
        </div>
      </div>
      */}
    </div>
  </div>
));

interface SectionProps {
  title: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children, icon }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    viewport={{ once: true }}
    className="mb-12 bg-white bg-opacity-10 rounded-xl p-6 shadow-lg"
  >
    <div className="flex items-center mb-4">
      {icon}
      <h2 className="text-3xl font-semibold ml-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-600">{title}</h2>
    </div>
    <div className="text-gray-200">{children}</div>
  </motion.section>
);

export default Home;
