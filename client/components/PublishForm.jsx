import { useState } from 'react';

const PublishForm = ({
  id,
  inputImage,
  outputImage,
  email,
  imagePairs,
  totalFeedback,
  prompts,
  reset,
  
}) => {
  const [visibility, setVisibility] = useState('public');
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [fromCulture, setFromCulture] = useState('');
  const [toCulture, setToCulture] = useState('');
  const [application, setApplication] = useState(''); 
  const [initialCultureRelevance, setInitialRelevance] = useState("");
  const [finalCultureRelevance, setFinalRelevance] = useState("");

  const [number, setNumber] = useState('');

  const numbers = [];

  for (let i = 0; i <= 500; i++) {
    numbers.push(i);
  }



  const relevanceNumbers = [ 1, 2, 3, 4,5]

  const cultures = [
    "Not Applicable", "Other", "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", 
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", 
    "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", 
    "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", 
    "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", 
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", 
    "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", 
    "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo", 
    "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor (Timor-Leste)", 
    "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", 
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", 
    "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", 
    "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", 
    "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", 
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", 
    "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", 
    "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", 
    "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", 
    "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (Burma)", 
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", 
    "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", 
    "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", 
    "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", 
    "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", 
    "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", 
    "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", 
    "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", 
    "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", 
    "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", 
    "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", 
    "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", 
    "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];
  
  const applications = ['Worksheets', 'Storybooks', 'Advertisements',"Graphics", "Other"];

  const Dropdown = ({ options, value, setValue, placeholder }) => (
    <div className="relative w-full mb-4">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 text-gray-700 py-3 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
    </div>
  );  

  const handleSubmit = async (e) => {
    if (uploadStatus == "Publishing...") {
      return;
    }
    e.preventDefault();

    if (!inputImage || !outputImage) {
      setUploadStatus('Please translate first!');
      return;
    } else if (!fromCulture || !toCulture || !application || !number || !finalCultureRelevance || !initialCultureRelevance) {
      setUploadStatus('Please ensure you have filled out all fields.');
      return;
    }

    try {
      setUploadStatus("Publishing... ")
      const date = new Date();
      const finalTitle = title.trim() || 'Unnamed';
      const vision = localStorage.getItem('vision') || '';
      const imageResponse = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          email,
          inputImage,
          outputImage,
          visibility,
          title: finalTitle,
          feedback: totalFeedback,
          steps: imagePairs,
          prompts: prompts,
          date,
          fromCulture,
          toCulture,
          application,
          number,
          initialCultureRelevance,
          finalCultureRelevance,
        
        }),
      });

      if (!imageResponse.ok) {
        throw new Error('Failed to upload image data');
      }

      const imageResult = await imageResponse.json();
      console.log('Image upload result:', imageResult);

      const feedbackResponse = await fetch(`${process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          steps: imagePairs,
          feedback: totalFeedback,
          prompts: prompts,
          fromCulture,
          toCulture,
          application,
          date,
          number,
          initialCultureRelevance,
          finalCultureRelevance,
        }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('Failed to upload feedback data');
      }

      const feedbackResult = await feedbackResponse.json();
      console.log('Feedback upload result:', feedbackResult);

      setUploadStatus(`Uploaded "${finalTitle}" as ${visibility}!`);
      
      
      setVisibility('public');
      setTitle('');
      setFromCulture('');
      setToCulture('');
      setApplication('');
      setNumber('');
      setInitialRelevance('');
      setFinalRelevance('');
      
      
      if (reset) {
        reset();
      }

      setTimeout(() => {
        setUploadStatus('');
      }, 3000);
    } catch (err) {
      console.error('Error uploading data:', err);
      setUploadStatus(`Failed to upload: ${err.message}`);
    }
    
  };

  return (
    <div className="w-full max-w-md p-8 rounded-xl border border-gray-200 bg-white shadow-xl transition-all duration-300 hover:shadow-2xl">
      <h2 className="text-3xl mb-8 text-blue-600 text-center font-bold">Publish Your Work</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Cultural Context</h3>
            <Dropdown
              options={cultures}
              value={fromCulture}
              setValue={setFromCulture}
              placeholder="Base Country"
            />
            <Dropdown
              options={cultures}
              value={toCulture}
              setValue={setToCulture}
              placeholder="Target Country"
            />
          </div>

        
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Details</h3>
            <Dropdown
              options={applications}
              value={application}
              setValue={setApplication}
              placeholder="Application"
            />
            <Dropdown
              options={numbers}
              value={number}
              setValue={setNumber}
              placeholder="Image ID"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-700">Visibility</h3>
            <div className="flex items-center space-x-6 p-4 rounded-lg">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="form-radio text-blue-500 focus:ring-blue-500 h-4 w-4"
                />
                <span className="ml-2 text-gray-700">Public</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === 'private'}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="form-radio  text-blue-500 focus:ring-blue-500 h-4 w-4"
                />
                <span className="ml-2 text-gray-700">Private</span>
              </label>
            </div>
          </div>

   
          <div className="space-y-2">
            <label className="block text-gray-700 font-semibold">Image Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your work"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 placeholder-gray-400 transition-all duration-200"
            />
          </div>

       
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700">Cultural Relevance</h3>
              <p className="text-sm text-gray-500 mt-1">1 = highly irrelevant, 5 = highly relevant</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                options={relevanceNumbers}
                value={initialCultureRelevance}
                setValue={setInitialRelevance}
                placeholder="Input Image"
              />
              <Dropdown
                options={relevanceNumbers}
                value={finalCultureRelevance}
                setValue={setFinalRelevance}
                placeholder="Output Image"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-4 rounded-lg hover:bg-blue-600 transition-all duration-300 font-semibold text-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          Publish
        </button>

        {uploadStatus && (
          <div className={`mt-4 p-3 rounded-lg text-center ${
            uploadStatus.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            <p className="font-medium text-sm">{uploadStatus}</p>
          </div>
        )}
      </form>
    </div>
  );
};

export default PublishForm;
