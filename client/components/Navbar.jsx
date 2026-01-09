"use client";
import { useUser } from "@/contexts/UserContext";
import { useGoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const Navbar = () => {
  const { user, login, logout } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const pathname = usePathname();

  const isRootPage = pathname === "/" || pathname === "/feedback";

  const DATA_COLLECTOR_PASSWORD = "collectionAccount123"; 
  const DATA_COLLECTOR_ACCOUNT = {
    email: "datacollector@platform.com",
    family_name: "Collector",
    given_name: "Data",
    name: "Data Collector",
    picture: "/assets/photo.png"
  };

  const handleDataCollectorLogin = () => {
    if (password === DATA_COLLECTOR_PASSWORD) {
      setIsLoading(true);
      
      fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...DATA_COLLECTOR_ACCOUNT,
          isDataCollector: true
        }),
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Failed to add data collector to database");
        })
        .then(data => {
          login({ ...DATA_COLLECTOR_ACCOUNT, isDataCollector: true });
          setShowPasswordModal(false);
          setPassword("");
          setPasswordError("");
        })
        .catch(error => {
          console.error("Error adding data collector:", error);
          setPasswordError("Error logging in. Please try again.");
        })
        .finally(() => setIsLoading(false));
    } else {
      setPasswordError("Incorrect password");
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setIsLoading(true);
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
          setIsLoading(false);

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
              }
              throw new Error("Failed to add user to database");
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
          setIsLoading(false);
        });
    },
    onError: () => {
      console.log("Login Failed");
      setIsLoading(false);
    },
  });

  return (
    <>
      <div className={`absolute navbar w-full font-semibold tracking-wide ${
        isRootPage ? 'bg-transparent' : 'bg-gradient-to-r from-blue-900 to-blue-800'
      } shadow-lg`}>
        <div className="flex-1">
          <Link href="/" className="btn btn-ghost hover:bg-transparent">
            <Image
              src="/assets/opennlp_logo.png"
              alt="OpenNLP Logo"
              width={40}
              height={40}
            />
          </Link>
        </div>
        <div className="flex-none gap-2">
          <ul className="menu menu-horizontal px-1 text-white">
            {user && (
              <>
                <li><Link href="/platform" className="hover:text-blue-200 transition-colors">HILITE</Link></li>
                <li><Link href="/gallery" className="hover:text-blue-200 transition-colors">Gallery</Link></li>
                <li><Link href="/edits" className="hover:text-blue-200 transition-colors">My Edits</Link></li>
                <li><Link href="/feedback" className="hover:text-blue-200 transition-colors">Feedback</Link></li>
              </>
            )}
          </ul>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <Image
                  alt="User profile"
                  src={user ? user.picture : "/assets/default.jpg"}
                  width={40}
                  height={40}
                />
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow"
            >
              {user ? (
                <>
                  <li>
                    <span className="cursor-default hover:bg-transparent">
                      {user.name}
                      {user.isDataCollector && " (Data Collector)"}
                    </span>
                  </li>
                  <li>
                    <a onClick={logout}>Sign Out</a>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <a onClick={() => googleLogin()} disabled={isLoading}>
                      {isLoading ? "Signing In..." : "Sign In with Google"}
                    </a>
                  </li>
                  <li>
                    <a onClick={() => setShowPasswordModal(true)}>
                      Data Collection Mode
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black p-6 rounded-lg w-96 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-white">Data Collection Mode</h2>
            {passwordError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">
                      {passwordError}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <input
              type="password"
              placeholder="Enter shared password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleDataCollectorLogin()}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                  setPasswordError("");
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDataCollectorLogin}
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
