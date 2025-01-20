# HILITE: Human-in-the-loop Interactive Tool for Image Editing 

**Abstract**
---
Image editing tools have a plethora of commercial and creative applications — content creation, digital photography, advertisements, graphic design, and development of educational media. The shortcomings of image editing software include difficulty of use and, for AI-based software, reliance on single image editing models, which often poses the dilemma of a tradeoff between image editing quality and user-friendliness. While the performances of individual image editing models have improved with their evolution over time, these singular models are often specialized on specific image editing tasks. In this work, we introduce HILITE, an open-source interactive image editing platform with a human-in-the-loop design that combines six diffusion-based image editing models. For one, HILITE’s accessible and easily-understandable user interface provides a straightforward user workflow from image input and prompt entry to selection of desired output. Secondly, the combination of several models with diverse specializations in turn allows HILITE to generalize on a wide variety of image editing tasks, essentially creating a “one-stop shop” for image editing. Third, HILITE iteratively takes user feedback, which both enhances the user experience and enables collection of crowd-sourced data for image editing. HILITE outperforms two major image editing softwares, OpenAI’s DALL·E 3 and Google’s Imagen 3, across two widely-user quantitative metrics for image editing evaluation. Considering the growing demand for readily-available and high-performing image editing tools, HILITE provides a novel platform design with multifaceted use cases in both business and academia. The platform can be found at https://platform.opennlplabs.org/ or https://platform-deployment.vercel.app/.

![HILITE Framework](client/public/assets/module.png)

HILITE was developed by researchers from OpenNLP Labs in collaboration with Stanford's SALT Lab and CMU's NeuLab. We are extremely grateful for the support and contributions of our mentors Simran Khanuja, Yutong Zhang, Diyi Yang, Graham Neubig, and Subha Vadlamannati in this work.

**Running HILITE**
---
HILITE consists of the following components: 
- Frontend
- Backend
- Intent
- Canvas
- Model Deployment

**Frontend**
---

**Next.js** • **Tailwind CSS** • **DaisyUI** • **Uploadthing** • **OAuth 2.0**

**Environment Variables**

```
NEXT_PUBLIC_EXPRESS_BACKEND_URL=
NEXT_PUBLIC_INTENT_API_URL=
NEXT_PUBLIC_STREAMLIT_APP=
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
UPLOADTHING_SECRET=
UPLOADTHING_TOKEN=
NEXT_PUBLIC_RUNPOD_API_KEY=
NEXT_PUBLIC_IP2P_ENDPOINT=
NEXT_PUBLIC_INVFREE_ENDPOINT=
NEXT_PUBLIC_CONTROL_ENDPOINT=
NEXT_PUBLIC_DEADIFF_ENDPOINT=
NEXT_PUBLIC_PAINT_ENDPOINT=
NEXT_PUBLIC_POWER_PAINT_ENDPOINT=
NEXT_PUBLIC_ANY_DOOR_ENDPOINT=
```

Place the .env file in the ```client``` folder

**Instructions**
```bash
cd client

npm install

npm run dev
```


**Backend**
---

**Express.js** • **Node.js** • **MongoDB**

**Environment Variables**


```
MONGODB_URI=
```

Place the .env file in the ```server``` folder


**Instructions**
```bash
cd server

npm install

node server.js
```

**Intent**
---

**Flask** • **Gemini** • **LangChain**


**Environment Variables**


```
GOOGLE_API_KEY=
```

Place the .env file in the ```intent``` folder

**Instructions**

```bash
cd intent

pip install -r requirements.txt

python intent.py
```


**Canvas**
---

**Streamlit**

**Environment Variables**


```
BACKEND_URL= 
RUNPOD_KEY= 
SAM2_ENDPOINT= 
MONGODB_URI= 
```

Place the .env file in the ```canvas``` folder

**Instructions**
```bash
cd streamlit

pip install -r requirements.txt

streamlit run canvas.py
```

**Model Deployment**
---

[Model Deployment Repository](https://github.com/machine-transcreation/model-deployment)






 



