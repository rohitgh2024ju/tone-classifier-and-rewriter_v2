from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import torch
import os
from groq import Groq
from dotenv import load_dotenv


# ---------------- ENVIRONMENT ----------------
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set in environment variables")

client = Groq(api_key=GROQ_API_KEY)


# ---------------- GLOBAL MODEL STATE ----------------
MODEL_NAME = "rohit2004ju/tone-classifier"

tokenizer = None
model = None
device = "cpu"


# ---------------- FASTAPI LIFESPAN ----------------
@asynccontextmanager
async def lifespan(app: FastAPI):

    global tokenizer, model

    print("Loading ToneLab DistilBERT model...")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME, dtype=torch.float16, low_cpu_mem_usage=True
    )



    model.to(device)
    model.eval()

    torch.set_grad_enabled(False)

    print("Model loaded successfully.")


    yield

    print("API shutting down.")


# ---------------- FASTAPI APP ----------------
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- CLASSIFICATION ----------------
def classify(text: str):

    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True).to(
        device
    )

    outputs = model(**inputs)

    logits = outputs.logits
    probs = torch.softmax(logits, dim=1).squeeze()

    labels = [
        "Casual",
        "Professional",
        "Polite",
        "Friendly",
        "Assertive",
        "Formal",
    ]

    results = []

    for i, prob in enumerate(probs):
        results.append({"label": labels[i], "confidence": round(prob.item() * 100, 2)})

    results = sorted(results, key=lambda x: x["confidence"], reverse=True)

    return results


# ---------------- TONE REWRITE ----------------
def rewrite(text, source_tone, target_tone):

    try:

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You rewrite sentences into different tones while preserving meaning.",
                },
                {
                    "role": "user",
                    "content": f"""
Rewrite the following sentence from {source_tone} tone to {target_tone} tone.

Rules:
- Generate EXACTLY 3 variations
- Keep each to one sentence
- No explanations
- Output numbered list
- Preserve intent

Sentence:
{text}
""",
                },
            ],
            temperature=0.6,
        )

        output = response.choices[0].message.content.strip()

        suggestions = []

        for line in output.split("\n"):

            line = line.strip()

            if not line:
                continue

            cleaned = line.lstrip("1234567890. ").strip()

            suggestions.append(cleaned)

        return suggestions[:3]

    except Exception as e:

        print("Rewrite error:", e)

        return ["Rewrite unavailable at the moment."]


# ---------------- REQUEST SCHEMA ----------------
class Profile(BaseModel):
    text: str
    target_tone: str = "Professional"


# ---------------- PREDICT ROUTE ----------------
@app.post("/predict")
def predict(data: Profile):

    try:

        predictions = classify(data.text)

        detected_tone = predictions[0]["label"]

        rewritten = rewrite(
            text=data.text, source_tone=detected_tone, target_tone=data.target_tone
        )

        return {
            "text": data.text,
            "detected_tone": detected_tone,
            "target_tone": data.target_tone,
            "predictions": predictions[:2],
            "suggestions": rewritten,
        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


# ---------------- HEALTH CHECK ----------------
@app.get("/")
def home():

    return {
        "message": "Tone Classifier API (DistilBERT)",
        "labels": [
            "Casual",
            "Professional",
            "Polite",
            "Friendly",
            "Assertive",
            "Formal",
        ],
    }
