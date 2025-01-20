require('dotenv').config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = process.env.PORT;


const uri = process.env.MONGODB_URI;
const client =new MongoClient(uri); 
app.use(bodyParser.json({limit: '50mb'}));
app.use(cors());

async function startServer() {
  try {
    await client.connect();
    
    const db = client.db("OpenNLP");
    const usersCollection = db.collection("users");
    const imagesCollection = db.collection("images");
    const uploadsCollection = db.collection("uploads");
    const feedbackCollection = db.collection("feedback");
    const archivesCollection = db.collection("archives");
    const userFeedbackCollection = db.collection("user_feedback");

    app.post("/add", async(req, res) => {
      try {
        const {email, family_name, given_name, name, picture} = req.body;

        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          await usersCollection.updateOne(
            { email },{ $set: { family_name, given_name, name, picture } }
          );
          return res.status(200).json({ message: "user updated" });
        }

        const result = await usersCollection.insertOne({
          email,family_name,given_name,name, picture
        });

        res.status(201).json({message: "user added",_id: result.insertedId });
      } catch (err) {
        console.error("error in add:", err);
        res.status(500).json({error:"failed to add" });
      }
    });

    app.post("/upload-image", async (req, res) => {
      console.log("Request body size:", JSON.stringify(req.body).length);
      Object.keys(req.body).forEach(key => {
        console.log(`${key} size:`, JSON.stringify(req.body[key]).length);
      });
      const date = new Date();
      try {
        const { email, inputImage, outputImage, visibility, title, steps, feedback, prompts, fromCulture, toCulture, application, number, initialCultureRelevance,
          finalCultureRelevance, } = req.body;
    
        const imageDocument = {
          email,
          inputImage,
          outputImage,
          visibility,
          title,
          date,
          steps,
          prompts,
          id:number,
          
          fromCulture,
          toCulture,
          application,
          

         
        };
    
        if (visibility === "public") {
          imageDocument.likes = 0;
          imageDocument.likedBy = []; 
        }
    
        const result = await imagesCollection.insertOne(imageDocument);
    
        const archiveDocument = {
          email,
          inputImage,
          outputImage,
          visibility,
          title,
          date,
          steps,
          feedback,
          prompts,
          fromCulture,
          toCulture,
          application,
          initialCultureRelevance,
          finalCultureRelevance,
          id: number,
         
        };

        const archiveResult = await archivesCollection.insertOne(archiveDocument);

        res.status(200).json({ message: "upload success", _id: result.insertedId });
      } catch (err) {
        console.error("Error uploading image:", err);
        res.status(500).json({ error: "Failed to upload image" });
      }
    });

    app.post("/feedback", async(req, res) => {
      const date = new  Date();
      try {
        const {steps, feedback, date, prompts, fromCulture, toCulture, application, number, initialCultureRelevance,
          finalCultureRelevance,} = req.body;
    
        const feedbackDocument = {
          date,
          steps,  
          prompts,
          feedback ,
          sourceCulture : fromCulture,
          targetCulture : toCulture,
          application: application,
          initialCultureRelevance,
          finalCultureRelevance,
          id: number,
        };
   
    
        const result = await feedbackCollection.insertOne(feedbackDocument);
    
        res.status(200).json({ message: "feedback success", _id: result.insertedId });
      } catch (err) {
        console.error("Error uploading feedbacl:", err);
        res.status(500).json({ error: "Failed to upload feedback" });
      }

    })

      app.post("/upload-mask", async (req, res) => {
        try {
          const { email, base_image, reference_image, base_mask, reference_mask } = req.body;
          const date = new Date();
          await uploadsCollection.deleteMany({ email });
    
          const maskDocument = {
            email,
            base_image,
            reference_image,
            base_mask,
            reference_mask,
            date,
          };
    
          const result = await uploadsCollection.insertOne(maskDocument);
      
          res.status(200).json({ message: "Mask data uploaded successfully", _id: result.insertedId });
        } catch (err) {
          console.error("Error uploading mask data:", err);
          res.status(500).json({ error: "Failed to upload mask data" });
        }
      });

      app.get("/fetch-mask/:email", async (req, res) => {
        try {
          const { email } = req.params;
          const maskData = await uploadsCollection.findOne({ email });
          
          if (maskData) {
            res.status(200).json(maskData);
          } else {
            res.status(404).json({ error: "Mask data not found" });
          }
        } catch (err) {
          console.error("Error fetching mask data:", err);
          res.status(500).json({ error: "Failed to fetch mask data" });
        }
      });
      
      
    app.get("/gallery", async (req, res) => {
        try {
          const images = await imagesCollection.find({ visibility: "public" }).toArray();
          const galleryData = await Promise.all(images.map(async (image) => {
            const user = await usersCollection.findOne({ email: image.email });
            return {
              imageData: { inputImage: image.inputImage, outputImage: image.outputImage,steps: image.steps,
                prompts: image.prompts,
                fromCulture: image.fromCulture,
                toCulture: image.toCulture,
                application: image.application, },
              userData: user,
              likes: image.likes,
              _id: image._id,
              title: image.title,
              date: image.date,
              visibility:image.visibility,
              
              
            };
          }));
          res.json(galleryData);
        } catch (err) {
          console.error("Error fetching gallery data:", err);
          res.status(500).json({ error: "Failed to fetch gallery data" });
        }
    });

    app.get("/edits/:email", async (req, res) => {
        const { email } = req.params;
        try {
          const images = await imagesCollection.find({ email }).toArray();
          const galleryData = await Promise.all(images.map(async (image) => {
            const user = await usersCollection.findOne({ email: image.email });
            return {
              imageData: { inputImage: image.inputImage, outputImage: image.outputImage,steps: image.steps,
                prompts: image.prompts,
                fromCulture: image.fromCulture,
                toCulture: image.toCulture,
                application: image.application, },
              userData: user,
              likes: image.likes,
              _id: image._id,
              title: image.title,
              date: image.date,
              visibility:image.visibility,
              
              
            };
          }));
          res.json(galleryData);
        } catch (err) {
          console.error("Error fetching gallery data:", err);
          res.status(500).json({ error: "Failed to fetch gallery data" });
        }
      });
      
    

    
      app.post("/like-image", async (req, res) => {
        try {
          const { imageId, userEmail } = req.body;
          
          const result = await imagesCollection.findOneAndUpdate(
            { _id: new ObjectId(imageId) },
            [
              {
                $set: {
                  likes: {
                    $cond: [
                      { $in: [userEmail, "$likedBy"] },
                      { $subtract: ["$likes", 1] },
                      { $add: ["$likes", 1] }
                    ]
                  },
                  likedBy: {
                    $cond: [
                      { $in: [userEmail, "$likedBy"] },
                      { $setDifference: ["$likedBy", [userEmail]] },
                      { $concatArrays: ["$likedBy", [userEmail]] }
                    ]
                  }
                }
              }
            ],
            { returnDocument: 'after' }
          );
      
          if (!result.value) {
            return res.status(404).json({ error: "Image not found" });
          }
      
          res.status(200).json({ 
            likes: result.value.likes, 
            isLiked: result.value.likedBy.includes(userEmail)
          });
        } catch (err) {
          console.error("Error updating like:", err);
          res.status(500).json({ error: "Failed to update like" });
        }
      });
      
      app.get("/check-like/:imageId/:userEmail", async (req, res) => {
        try {
          const { imageId, userEmail } = req.params;
          const image = await imagesCollection.findOne({ _id: new ObjectId(imageId) });
          
          if (!image) {
            return res.status(404).json({ error: "Image not found" });
          }
          
          const liked = image.likedBy.includes(userEmail);
          res.json({ liked });
        } catch (err) {
          console.error("Error checking like:", err);
          res.status(500).json({ error: "Failed to check like" });
        }
      });
      app.delete("/delete-image/:imageId", async (req, res) => {
        const { imageId } = req.params;
        try {
          const result = await imagesCollection.deleteOne({ _id: new ObjectId(imageId) });
          if (result.deletedCount === 1) {
            res.status(200).json({ message: "Image deleted successfully" });
          } else {
            res.status(404).json({ error: "Image not found" });
          }
        } catch (err) {
          console.error("Error deleting image:", err);
          res.status(500).json({ error: "Failed to delete image" });
        }
      });
      
      app.post("/confirm-data", async (req, res) => {
        try {
          const { email } = req.body;
      
          const user = await uploadsCollection.findOne({ email });
      
          if (user) {
            res.status(200).json({ exists: true, message: "User found" });
          } else {
            res.status(404).json({ exists: false, message: "User not found" });
          }
        } catch (err) {
          console.error("Error confirming data:", err);
          res.status(500).json({ error: "Failed to confirm data" });
        }
      });

      app.post("/delete-documents", async (req, res) => {
        const { email } = req.body;
  
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }
  
        try {
          const result = await uploadsCollection.deleteMany({ email });
          res.status(200).json({ message: 'Documents deleted successfully', result });
        } catch (err) {
          console.error("Error deleting documents:", err);
          res.status(500).json({ error: 'Internal server error' });
        }
      });

      app.get("/data", async (req, res) => {
        try {
          const feedbackData = await archivesCollection.find({}).toArray();
          res.json(feedbackData);
        } catch (err) {
          console.error("Error fetching feedback data:", err);
          res.status(500).json({ error: "Failed to fetch feedback data" });
        }
      });

      app.post("/submit-feedback", async (req, res) => {
        const {rating, category, comment, timestamp } = req.body;
  
        if (!rating || !category || !comment) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
  
        try {
          const feedback = {
            rating: parseInt(rating),
            category,
            comment,
            timestamp,
            createdAt: new Date()
          };
  
          const result = await userFeedbackCollection.insertOne(feedback);
          res.status(201).json({ 
            message: 'Feedback submitted successfully',
            feedbackId: result.insertedId 
          });
        } catch (err) {
          console.error("Error submitting feedback:", err);
          res.status(500).json({ error: 'Internal server error' });
        }
      });
      

    app.listen(port, () => {
      console.log("Server running on port");
    });
  } catch (err) {
    process.exit(1);
  }
}

startServer();
