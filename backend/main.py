from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from tweepy import OAuth1UserHandler, API
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr
import os
import joblib
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from pytrends.request import TrendReq
from pytrends.exceptions import TooManyRequestsError
import traceback
import time
from collections import defaultdict
from datetime import datetime, timedelta
from jose import JWTError, jwt
import json
import http.client
from typing import Dict, List
import numpy as np
from PIL import Image
import tensorflow as tf
from pathlib import Path
import bcrypt
from bson import ObjectId


# Load environment variables
load_dotenv()

# Twitter API credentials
API_KEY = "6496790f8bmsha07b1cf7256f9c2p1995fbjsne7ca8be11817"
API_SECRET_KEY = "SKHmppgEHdjhWo5UdAOuyccDELGema5KiNqZM2VFGBxi03sRLF"
ACCESS_TOKEN = "Q0NKb2k1cEhrWEpZMXpVRlN4S2o6MTpjaQ"
ACCESS_TOKEN_SECRET = "OEe2ThJ1z5-UIrpoh92Jfvxi6ryKKkOjJoCbGCikwkpRXX03HF"

# Authenticate with Twitter API
auth = OAuth1UserHandler(API_KEY, API_SECRET_KEY, ACCESS_TOKEN, ACCESS_TOKEN_SECRET)
twitter_api = API(auth)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this with your frontend's origin for better security
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

UPLOADS_DIR = "./uploads"

Path(UPLOADS_DIR).mkdir(parents=True, exist_ok=True)

# DB Configurations
MONGODB_CONNECTION_URL = "mongodb+srv://dbuser:111222333@cluster0.4uumjvi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = AsyncIOMotorClient(MONGODB_CONNECTION_URL)
db = client["tea_manage_db"]
user_collection = db["users"]

# User Management 
class UserModel(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str
    role: str
    avatar: str

class UserResponseModel(BaseModel):
    id: str
    username: str
    full_name: str
    email: EmailStr
    role: str
    avatar: str

async def get_user_by_email(email: str):
    return await user_collection.find_one({"email": email})

async def get_user_by_id(user_id: ObjectId):
    return await user_collection.find_one({"_id": user_id})


async def get_user_by_username(username: str):
    return await user_collection.find_one({"username": username})

@app.post("/users", response_model=UserResponseModel)
async def create_user(user: UserModel):
    # Check if user already exists
    user_exists = await get_user_by_email(user.email)
    if user_exists:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hash the user's password
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    user.password = hashed_password.decode('utf-8')
    
    # Insert the user into the database
    user_dict = jsonable_encoder(user)
    result = await user_collection.insert_one(user_dict)
    
    # Retrieve the inserted user
    new_user = await get_user_by_id(result.inserted_id)
    
    # Map _id to id for the response model
    new_user_response = {
        "id": str(new_user["_id"]),  # Convert ObjectId to string and map to id
        "username": new_user["username"],
        "full_name": new_user["full_name"],
        "email": new_user["email"],
        "role": new_user["role"],
        "avatar": new_user["avatar"]
    }
    
    return UserResponseModel(**new_user_response)


@app.get("/users/{username}", response_model=UserResponseModel)
async def get_user(username: str):
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponseModel(
        id=str(user["_id"]),
        username=user["username"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        avatar=user["avatar"]
    )

@app.get("/users", response_model=list[UserResponseModel])
async def get_all_users():
    users_cursor = user_collection.find({})
    users = await users_cursor.to_list(None)  # Fetch all users

    return [
        UserResponseModel(
            id=str(user["_id"]),
            username=user["username"],
            full_name=user["full_name"],
            email=user["email"],
            role=user["role"],
            avatar=user["avatar"]
        ) for user in users
    ]

SECRET_KEY = "key-teax"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponseModel

@app.post("/login", response_model=LoginResponse)
async def login_user(credentials: LoginRequest):
    user = await get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Compare hashed password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Generate JWT token
    token_data = {"sub": user["email"]}
    token = create_access_token(token_data)

    # Prepare user response
    user_response = UserResponseModel(
        id=str(user["_id"]),
        username=user["username"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        avatar=user["avatar"]
    )

    return LoginResponse(token=token, user=user_response)


# Tea Collection Model
class TeaCollectionModel(BaseModel):
    user: str  # user email or user ID
    station: str
    weight: float
    comment: str
    collected_date: str  # YYYY-MM-DD

class TeaCollectionResponseModel(BaseModel):
    id: str
    user: str
    station: str
    weight: float
    comment: str
    collected_date: str
    created_at: str

# Create new collection for tea records
tea_collection = db["tea_collections"]

# Utility functions for tea collections
async def get_tea_collection_by_id(collection_id: str):
    try:
        collection = await tea_collection.find_one({"_id": ObjectId(collection_id)})
        return collection
    except:
        return None

async def get_tea_collections_by_user(user: str):
    collections = await tea_collection.find({"user": user}).to_list(length=1000)
    return collections

async def get_tea_collections_by_date(date: str):
    collections = await tea_collection.find({"collected_date": date}).to_list(length=1000)
    return collections

async def get_tea_collections_by_user_and_date(user: str, date: str):
    collections = await tea_collection.find({"user": user, "collected_date": date}).to_list(length=1000)
    return collections

async def get_all_tea_collections():
    collections = await tea_collection.find().to_list(length=1000)
    return collections

# API Endpoints for Tea Collections
@app.post("/tea-collections", response_model=TeaCollectionResponseModel)
async def create_tea_collection(collection: TeaCollectionModel):
    # Validate date format
    try:
        datetime.strptime(collection.collected_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate weight is positive
    if collection.weight <= 0:
        raise HTTPException(status_code=400, detail="Weight must be positive")
    
    # Check if user exists (optional validation)
    user_exists = await get_user_by_email(collection.user)
    if not user_exists:
        # Try finding by username if not found by email
        user_exists = await user_collection.find_one({"username": collection.user})
        if not user_exists:
            raise HTTPException(status_code=404, detail="User not found")
    
    # Create collection document
    collection_dict = jsonable_encoder(collection)
    collection_dict["created_at"] = datetime.utcnow().isoformat()
    
    # Insert the collection into the database
    result = await tea_collection.insert_one(collection_dict)
    
    # Retrieve the inserted collection
    new_collection = await get_tea_collection_by_id(str(result.inserted_id))
    
    # Map _id to id for the response model
    collection_response = {
        "id": str(new_collection["_id"]),
        "user": new_collection["user"],
        "station": new_collection["station"],
        "weight": new_collection["weight"],
        "comment": new_collection["comment"],
        "collected_date": new_collection["collected_date"],
        "created_at": new_collection["created_at"]
    }
    
    return TeaCollectionResponseModel(**collection_response)

@app.get("/tea-collections", response_model=List[TeaCollectionResponseModel])
async def get_all_collections():
    collections = await get_all_tea_collections()
    
    if not collections:
        return []
    
    # Convert to response model
    collections_response = []
    for collection in collections:
        collection_response = {
            "id": str(collection["_id"]),
            "user": collection["user"],
            "station": collection["station"],
            "weight": collection["weight"],
            "comment": collection["comment"],
            "collected_date": collection["collected_date"],
            "created_at": collection.get("created_at", "")
        }
        collections_response.append(TeaCollectionResponseModel(**collection_response))
    
    return collections_response

@app.get("/tea-collections/user/{user}", response_model=List[TeaCollectionResponseModel])
async def get_collections_by_user(user: str):
    collections = await get_tea_collections_by_user(user)
    
    if not collections:
        return []
    
    # Convert to response model
    collections_response = []
    for collection in collections:
        collection_response = {
            "id": str(collection["_id"]),
            "user": collection["user"],
            "station": collection["station"],
            "weight": collection["weight"],
            "comment": collection["comment"],
            "collected_date": collection["collected_date"],
            "created_at": collection.get("created_at", "")
        }
        collections_response.append(TeaCollectionResponseModel(**collection_response))
    
    return collections_response

@app.get("/tea-collections/date/{date}", response_model=List[TeaCollectionResponseModel])
async def get_collections_by_date(date: str):
    # Validate date format
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    collections = await get_tea_collections_by_date(date)
    
    if not collections:
        return []
    
    # Convert to response model
    collections_response = []
    for collection in collections:
        collection_response = {
            "id": str(collection["_id"]),
            "user": collection["user"],
            "station": collection["station"],
            "weight": collection["weight"],
            "comment": collection["comment"],
            "collected_date": collection["collected_date"],
            "created_at": collection.get("created_at", "")
        }
        collections_response.append(TeaCollectionResponseModel(**collection_response))
    
    return collections_response

@app.get("/tea-collections/user/{user}/date/{date}", response_model=List[TeaCollectionResponseModel])
async def get_collections_by_user_and_date(user: str, date: str):
    # Validate date format
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    collections = await get_tea_collections_by_user_and_date(user, date)
    
    if not collections:
        return []
    
    # Convert to response model
    collections_response = []
    for collection in collections:
        collection_response = {
            "id": str(collection["_id"]),
            "user": collection["user"],
            "station": collection["station"],
            "weight": collection["weight"],
            "comment": collection["comment"],
            "collected_date": collection["collected_date"],
            "created_at": collection.get("created_at", "")
        }
        collections_response.append(TeaCollectionResponseModel(**collection_response))
    
    return collections_response

@app.get("/tea-collections/{collection_id}", response_model=TeaCollectionResponseModel)
async def get_collection_by_id(collection_id: str):
    collection = await get_tea_collection_by_id(collection_id)
    
    if not collection:
        raise HTTPException(status_code=404, detail="Tea collection not found")
    
    collection_response = {
        "id": str(collection["_id"]),
        "user": collection["user"],
        "station": collection["station"],
        "weight": collection["weight"],
        "comment": collection["comment"],
        "collected_date": collection["collected_date"],
        "created_at": collection.get("created_at", "")
    }
    
    return TeaCollectionResponseModel(**collection_response)

@app.delete("/tea-collections/{collection_id}")
async def delete_tea_collection(collection_id: str):
    # Check if collection exists
    collection = await get_tea_collection_by_id(collection_id)
    
    if not collection:
        raise HTTPException(status_code=404, detail="Tea collection not found")
    
    # Delete the collection
    result = await tea_collection.delete_one({"_id": ObjectId(collection_id)})
    
    if result.deleted_count == 1:
        return {"message": "Tea collection deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete tea collection")

@app.put("/tea-collections/{collection_id}", response_model=TeaCollectionResponseModel)
async def update_tea_collection(collection_id: str, updated_collection: TeaCollectionModel):
    # Check if collection exists
    existing_collection = await get_tea_collection_by_id(collection_id)
    
    if not existing_collection:
        raise HTTPException(status_code=404, detail="Tea collection not found")
    
    # Validate date format
    try:
        datetime.strptime(updated_collection.collected_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate weight is positive
    if updated_collection.weight <= 0:
        raise HTTPException(status_code=400, detail="Weight must be positive")
    
    # Update the collection
    update_data = jsonable_encoder(updated_collection)
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    await tea_collection.update_one(
        {"_id": ObjectId(collection_id)},
        {"$set": update_data}
    )
    
    # Retrieve the updated collection
    updated_collection_data = await get_tea_collection_by_id(collection_id)
    
    collection_response = {
        "id": str(updated_collection_data["_id"]),
        "user": updated_collection_data["user"],
        "station": updated_collection_data["station"],
        "weight": updated_collection_data["weight"],
        "comment": updated_collection_data["comment"],
        "collected_date": updated_collection_data["collected_date"],
        "created_at": updated_collection_data.get("created_at", "")
    }
    
    return TeaCollectionResponseModel(**collection_response)


# Initialize pytrends
pytrends = TrendReq()

# Load Models
sales_model = joblib.load('sales/model_sales_quantity_new.joblib')

types_model = joblib.load('tea_type_demand_rf.joblib')

models = {
    "china": joblib.load("export_demand/export_china_rf.joblib"),
    "germany": joblib.load("export_demand/export_Germany_rf.joblib"),
    "iran": joblib.load("export_demand/export_Iran_rf.joblib"),
    "japan": joblib.load("export_demand/export_JPA_rf.joblib"),
    "russia": joblib.load("export_demand/export_RUSS_rf.joblib"),
    "uk": joblib.load("export_demand/export_UK_rf.joblib"),
    "usa": joblib.load("export_demand/export_USA_rf.joblib"),
}

    
elevation_map = {'High grown': 0, 'Low grown': 1, 'Mid grown': 2, 'Unknown': 3}

# Pydantic model for Sales Predict
class PredictionInput(BaseModel):
    year: float
    dollar_rate: float
    elevation: str  # Input elevation as a string
    avg_price: float
    sales_code: int

@app.post("/predict/sales-quantity")
async def predict_sales_quantity(input_data: PredictionInput):
    
    try:
        # Encode elevation
        elevation_encoded = elevation_map.get(input_data.elevation, elevation_map['Unknown'])
        
        model_input = [
            [
                input_data.year,
                input_data.sales_code,
                input_data.dollar_rate,
                elevation_encoded,
                input_data.avg_price,
            ]
        ]
        
        prediction = sales_model.predict(model_input)
        
        return {"predicted_quantity": prediction[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}")
    
# Endpoint for Export Demand by country
class DemandPredictionInput(BaseModel):
    year: int
    month: int
    CH_CPI: float
    Type: str  # Type should match the categories used during training
    country: str  # Country for which prediction is required

@app.post("/predict/demand")
async def predict_demand(input_data: DemandPredictionInput):
    print(input_data.CH_CPI)
    
    try:
        # Ensure the country has a corresponding model
        country = input_data.country.lower()
        if country not in models:
            raise HTTPException(
                status_code=400,
                detail=f"No model available for the country: {country.capitalize()}",
            )
        
        # Load the correct model
        selected_model = models[country]

        # Prepare input data for the model
        type_encoding = {"Black": 0, "Green": 1}  # Adjust based on your dataset encoding
        type_encoded = type_encoding.get(input_data.Type, -1)
        if type_encoded == -1:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Type: {input_data.Type}. Allowed values are 'Black' or 'Green'.",
            )

        model_input = [[
            input_data.year,
            input_data.month,
            input_data.CH_CPI,
            type_encoded
        ]]

        # Predict demand
        prediction = selected_model.predict(model_input)

        yr_weights_balance = input_data.year - 2020
        if(yr_weights_balance > 0):
            prediction[0] = prediction[0] + ((prediction[0]*yr_weights_balance)/100)

        return {
            "country": country.capitalize(),
            "predicted_demand": prediction[0],
            "month": input_data.month
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}") 

# Tea Types
# Categorical mappings
processing_method_mapping = {'CTC TEA': 0, 'GREEN TEA': 1, 'ORTHODOX': 2}
elevation_mapping = {'HIGH': 0, 'LOW': 1, 'MEDIUM': 2}

# Request model for validation
class PredictionRequest(BaseModel):
    year: int
    month: int
    processing_method: str
    elevation: str
    inflation_rate: float

@app.post("/predict/local-market-release")
async def predict_local_market_release(data: PredictionRequest):
    """
    Predicts the Local market Release Quantity (Kg) using the trained Random Forest model.
    """
    if types_model is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly.")

    # Map the categorical inputs to encoded values
    processing_method_encoded = processing_method_mapping.get(data.processing_method)
    elevation_encoded = elevation_mapping.get(data.elevation)

    if processing_method_encoded is None or elevation_encoded is None:
        raise HTTPException(status_code=400, detail="Invalid processing method or elevation value provided.")

    # Prepare the input data for prediction
    input_data = pd.DataFrame([{
        'year': data.year,
        'month': data.month,
        'Processing Method': processing_method_encoded,
        'Elevation': elevation_encoded,
        'whole production Quantity (Kg)': 0,  
        'production Total (kg)': 0,          
        'inflation rate': data.inflation_rate
    }])

    # Handle missing values in features
    input_data = input_data.fillna(input_data.median())

    try:
        # Predict using the trained model
        prediction = types_model.predict(input_data)
        return {"predicted_local_market_release_quantity": prediction[0]}
    except Exception as e:
        error_message = traceback.format_exc()
        print(error_message)
        raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}")


class PredictionRequestX(BaseModel):
    elevation: str
    inflation_rate: float


@app.get("/predict/local-market-release/{tea_type}")
async def predict_local_market_release(tea_type: str, data: PredictionRequestX):
    """
    Predicts the Local Market Release Quantity (Kg) for months 1 to 10 of 2025 based on tea type and input data.
    """
    if types_model is None:
        raise HTTPException(status_code=500, detail="Model not loaded properly.")

    # Map the categorical inputs to encoded values
    processing_method_encoded = processing_method_mapping.get(tea_type.upper())
    elevation_encoded = elevation_mapping.get(data.elevation)

    if processing_method_encoded is None:
        raise HTTPException(status_code=400, detail="Invalid tea type provided.")
    if elevation_encoded is None:
        raise HTTPException(status_code=400, detail="Invalid elevation value provided.")

    try:
        # Generate predictions for months 1 through 10
        predictions = []
        for month in range(1, 11):
            input_data = pd.DataFrame([{
                'year': 2025,
                'month': month,
                'Processing Method': processing_method_encoded,
                'Elevation': elevation_encoded,
                'whole production Quantity (Kg)': 0,  # Default or dynamic input
                'production Total (kg)': 0,          # Default or dynamic input
                'inflation rate': data.inflation_rate
            }])

            # Handle missing values in features
            input_data = input_data.fillna(input_data.median())

            # Predict using the trained model
            prediction = types_model.predict(input_data)
            predictions.append({
                "month": month,
                "predicted_quantity": prediction[0]
            })

        return {
            "tea_type": tea_type,
            "year": 2025,
            "elevation": data.elevation,
            "inflation_rate": data.inflation_rate,
            "predictions": predictions
        }

    except Exception as e:
        error_message = traceback.format_exc()
        print(error_message)
        raise HTTPException(status_code=500, detail=f"Error during prediction: {str(e)}")


# Local Demand 

loaded_model_1 = joblib.load("local_market_demand/lm_random_forest_model.joblib")
loaded_model_2 = joblib.load("local_market_demand/lm_lgbm_model.joblib")
loaded_model_3 = joblib.load("local_market_demand/lm_etr_model.joblib")

# Dictionary to store models
MULTI_MODELS_DEMAND = {
    "Random Forest": loaded_model_1,
    "LightGBM": loaded_model_2,
    "Extra Trees": loaded_model_3
}

loaded_model_wp1 = joblib.load("whole_production/wp_random_forest_model.joblib")
loaded_model_wp2 = joblib.load("whole_production/wp_lgbm_model.joblib")
loaded_model_wp3 = joblib.load("whole_production/wp_etr_model.joblib")

# Dictionary to store models
MULTI_MODELS_WHOLE_PROD = {
    "Random Forest": loaded_model_wp1,
    "LightGBM": loaded_model_wp2,
    "Extra Trees": loaded_model_wp3
}

class TeaProductionInput(BaseModel):
    year: int
    month: int
    processing_method: str
    elevation: str
    production_total: float
    inflation_rate: float
    temp_avg: float
    rain: float
    humidity_day: float
    humidity_night: float

class TeaProductionInputUpdated(BaseModel):
    year: int
    month: int
    processing_method: str
    elevation: str
    inflation_rate: float
    temp_avg: float
    rain: float
    humidity_day: float
    humidity_night: float

# Dummy label encoding function (Replace with actual encoding logic)
def encode_labels(processing_method, elevation):
    processing_method_mapping = {"Orthodox": 0, "CTC": 1, "Green": 2}
    elevation_mapping = {"Low": 0, "Medium": 1, "High": 2}

    return (processing_method_mapping.get(processing_method, -1), 
            elevation_mapping.get(elevation, -1))

# Prediction function
def predict_tea_production_ensemble(year, month, processing_method, elevation, production_total, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night):
    try:
        # Encode labels
        processing_method_encoded, elevation_encoded = encode_labels(processing_method, elevation)
        
        if processing_method_encoded == -1 or elevation_encoded == -1:
            return {"error": "Invalid processing method or elevation label."}
        
        # Create input data as DataFrame
        input_data = pd.DataFrame([[year, month, processing_method_encoded, elevation_encoded, production_total, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night]],
                                  columns=["year", "month", "Processing Method", "Elevation", "production Total (kg)",
                                           "inflation rate", "Temp AVG", "Rain", "Humidity Day", "Humidity Night"])

        # Get predictions from all models
        predictions = np.array([model.predict(input_data)[0] for model in MULTI_MODELS_DEMAND.values()])
        
        # Average predictions
        final_prediction = np.mean(predictions)

        return {"predicted_tea_production": final_prediction}
    
    except Exception as e:
        return {"error": str(e)}

# FastAPI endpoint
@app.post("/predict-tea-production")
async def predict_tea_production(input_data: TeaProductionInput):
    result = predict_tea_production_ensemble(
        input_data.year, input_data.month, input_data.processing_method, input_data.elevation, 
        input_data.production_total, input_data.inflation_rate, input_data.temp_avg, 
        input_data.rain, input_data.humidity_day, input_data.humidity_night
    )
    return result

def predict_tea_production_weighted(year, month, processing_method, elevation, production_total, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night):
    try:
        # Encode labels
        processing_method_encoded, elevation_encoded = encode_labels(processing_method, elevation)
        
        if processing_method_encoded == -1 or elevation_encoded == -1:
            return {"error": "Invalid processing method or elevation label."}
        
        # Create input data as DataFrame
        input_data = pd.DataFrame([[year, month, processing_method_encoded, elevation_encoded, production_total, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night]],
                                  columns=["year", "month", "Processing Method", "Elevation", "production Total (kg)",
                                           "inflation rate", "Temp AVG", "Rain", "Humidity Day", "Humidity Night"])

        # Get predictions from all models
        predictions = np.array([model.predict(input_data)[0] for model in MULTI_MODELS_DEMAND.values()])
        
        # Define model weights (assign higher weights to better models)
        weights = np.array([0.4, 0.3, 0.3])  # Example: Higher weight to Random Forest
        
        # Compute weighted prediction
        yr_weights_balance = year - 2020

        final_prediction = np.sum(predictions * weights)
        if(yr_weights_balance > 0):
            final_prediction = final_prediction + ((final_prediction*yr_weights_balance)/100)
        

        return {"predicted_tea_production": final_prediction}
    
    except Exception as e:
        return {"error": str(e)}

# FastAPI endpoint
@app.post("/predict-tea-production-weighted")
async def predict_tea_production(input_data: TeaProductionInput):
    result = predict_tea_production_weighted(
        input_data.year, input_data.month, input_data.processing_method, input_data.elevation, 
        input_data.production_total, input_data.inflation_rate, input_data.temp_avg, 
        input_data.rain, input_data.humidity_day, input_data.humidity_night
    )

    return result

def predict_tea_whole_production_weighted(year, month, processing_method, elevation, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night):
    try:
        # Encode labels
        processing_method_encoded, elevation_encoded = encode_labels(processing_method, elevation)
        
        if processing_method_encoded == -1 or elevation_encoded == -1:
            return {"error": "Invalid processing method or elevation label."}
        
        # Create input data as DataFrame
        input_data = pd.DataFrame([[year, month, processing_method_encoded, elevation_encoded, 
                                    inflation_rate, temp_avg, rain, humidity_day, humidity_night]],
                                  columns=["year", "month", "Processing Method", "Elevation",
                                           "inflation rate", "Temp AVG", "Rain", "Humidity Day", "Humidity Night"])

        # Get predictions from all models
        predictions = np.array([model.predict(input_data)[0] for model in MULTI_MODELS_WHOLE_PROD.values()])
        
        # Define model weights (assign higher weights to better models)
        weights = np.array([0.4, 0.3, 0.3])  # Example: Higher weight to Random Forest
        
        # Compute weighted prediction
        yr_weights_balance = year - 2020

        final_prediction = np.sum(predictions * weights)
        if(yr_weights_balance > 0):
            final_prediction = final_prediction + ((final_prediction*yr_weights_balance)/100)
        

        return {"predicted_tea_whole_production": final_prediction}
    
    except Exception as e:
        return {"error": str(e)}

@app.post("/predict-tea-whole-production-weighted")
async def predict_tea_whole_production(input_data: TeaProductionInputUpdated):
    result = predict_tea_whole_production_weighted(
        input_data.year, input_data.month, input_data.processing_method, input_data.elevation, 
        input_data.inflation_rate, input_data.temp_avg, 
        input_data.rain, input_data.humidity_day, input_data.humidity_night
    )


    return result

# Trend Analysis
class TrendRequest(BaseModel):
    topics: list[str]



@app.post("/get-google-trends")
async def get_google_trends(request: TrendRequest):
    """
    Fetches Google Trends data for the specified topics over the last 5 years.
    """
    pytrends = TrendReq(hl='en-US', tz=360)
    topics = request.topics
    data = {}

    for topic in topics:
        while True:
            try:
                pytrends.build_payload([topic], timeframe='today 5-y', geo='', gprop='')
                interest_over_time = pytrends.interest_over_time()
                data[topic] = interest_over_time[topic].tolist()
                time.sleep(60)  # Increase delay
                break
            except TooManyRequestsError:
                print(f"Too many requests for topic: {topic}. Retrying after 5 minutes.")
                time.sleep(300)  # Wait 5 minutes before retrying

    return {"trend_data": data}


@app.post("/get-google-trends-dates")
async def get_google_trends(request: TrendRequest):
    """
    Fetches Google Trends data for the specified topics over the last 5 years.
    """
    pytrends = TrendReq(hl='en-US', tz=360)
    topics = request.topics
    trend_data = {}
    shared_dates = []

    for idx, topic in enumerate(topics):
        while True:
            try:
                # Build the payload for the topic
                pytrends.build_payload([topic], timeframe='today 5-y', geo='', gprop='')
                interest_over_time = pytrends.interest_over_time()

                # For the first topic, extract and store shared dates
                if idx == 0:
                    shared_dates = interest_over_time.index.strftime('%Y-%m-%d').tolist()

                # Extract interest counts for the topic
                trend_data[topic] = interest_over_time[topic].tolist()

                time.sleep(60)  # Delay to prevent hitting request limits
                break
            except TooManyRequestsError:
                print(f"Too many requests for topic: {topic}. Retrying after 5 minutes.")
                time.sleep(300)  # Wait before retrying

    # Response format
    return {
        "trend_data": {
            **trend_data,
            "dates": shared_dates
        }
    }

RAPIDAPI_KEY = "6496790f8bmsha07b1cf7256f9c2p1995fbjsne7ca8be11817"
RAPIDAPI_HOST = "google-search74.p.rapidapi.com"

@app.post("/get-google-trends-dates-new")
async def get_google_trends_RAPID(request: TrendRequest):
    """
    Fetches Google search trend-related data for the specified topics.
    """
    conn = http.client.HTTPSConnection(RAPIDAPI_HOST)

    headers = {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
    }

    trend_data = {}
    shared_dates = []  

    for topic in request.topics:
        try:
            query = f"/?query={topic}&limit=10&related_keywords=true"
            conn.request("GET", query, headers=headers)

            res = conn.getresponse()
            data = res.read()
            response_json = json.loads(data.decode("utf-8"))

            # Extract relevant trend-related data
            results = response_json.get("results", [])
            keywords = response_json.get("related_keywords", [])

            trend_data[topic] = {
                "results": results,  # List of search result summaries
                "related_keywords": keywords  # Related search terms
            }

            time.sleep(2)  # Short delay to prevent API rate limiting

        except Exception as e:
            print(f"Error fetching data for {topic}: {e}")
            trend_data[topic] = {"error": "Failed to fetch data"}

    return {
        "trend_data": {
            **trend_data,
            "dates": shared_dates
        }
    }


# Anlyze Twitter 
class YearlyPostCount(BaseModel):
    year: int
    post_count: int

@app.get("/fetch-and-analyze-posts")
async def fetch_and_analyze_posts(query: str = "tea", count: int = 20) -> List[YearlyPostCount]:
    """
    Fetches posts from the Twitter API, processes post data, groups posts by year, and counts them.

    Args:
        query (str): Search query for Twitter data.
        count (int): Number of posts to retrieve.

    Returns:
        List[YearlyPostCount]: List of post counts grouped by year.
    """
    try:
        # Make request to Twitter API
        data_string = fetch_twitter_data(query, count)

        # Extract posts with content and dates
        posts = extract_posts_with_dates(data_string)
        if not posts:
            raise HTTPException(status_code=400, detail="No valid posts found in the data.")

        # Group posts by year and count them
        year_counts = group_posts_by_year(posts)

        # Convert to sorted list of YearlyPostCount
        yearly_post_counts = sorted(
            [YearlyPostCount(year=year, post_count=count) for year, count in year_counts.items()],
            key=lambda x: x.year
        )

        return yearly_post_counts
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def fetch_twitter_data(query: str, count: int) -> str:
    """
    Fetches Twitter data using the Twitter API.

    Args:
        query (str): Search query for Twitter data.
        count (int): Number of posts to retrieve.

    Returns:
        str: JSON string containing Twitter data.
    """
    conn = http.client.HTTPSConnection("twitter241.p.rapidapi.com")

    headers = {
        'x-rapidapi-key': "6496790f8bmsha07b1cf7256f9c2p1995fbjsne7ca8be11817",
        'x-rapidapi-host': "twitter241.p.rapidapi.com"
    }

    conn.request("GET", f"/search-v2?type=Top&count={count}&query={query}", headers=headers)
    res = conn.getresponse()
    data = res.read()

    return data.decode("utf-8")

# Helper function: Extract posts with their dates
def extract_posts_with_dates(data_string):
    posts_with_dates = []
    data = json.loads(data_string)
    instructions = data.get("result", {}).get("timeline", {}).get("instructions", [])

    for instruction in instructions:
        entries = instruction.get("entries", [])
        for entry in entries:
            content = entry.get("content", {})
            if content.get("__typename") == "TimelineTimelineModule":
                items = content.get("items", [])
                for item in items:
                    user_content = item.get("item", {}).get("itemContent", {}).get("user_results", {}).get("result", {}).get("legacy", {})
                    description = user_content.get("description", "")
                    created_at = user_content.get("created_at", "")

                    if description and created_at:
                        posts_with_dates.append({
                            "content": description,
                            "date": created_at
                        })

    return posts_with_dates

# Helper function: Group posts by year
def group_posts_by_year(posts):
    year_counts = defaultdict(int)
    for post in posts:
        try:
            post_date = datetime.strptime(post['date'], '%a %b %d %H:%M:%S %z %Y')
            year = post_date.year
            year_counts[year] += 1
        except Exception as e:
            print(f"Error parsing date for post: {post}, Error: {e}")

    return dict(year_counts)


# Facebook Analyssis
def count_posts_by_year(data):

    year_count = defaultdict(int)

    # Loop through each post in the response
    for post in data.get("results", []):
        timestamp = post.get("timestamp")
        comments_count = post.get("comments_count", 0)
        if timestamp:
            # Convert timestamp to a datetime object
            date = datetime.utcfromtimestamp(timestamp)
            year = date.year
            year_count[year] = year_count[year] + comments_count

    # Sorting the years in ascending order and return the result
    sorted_year_count = dict(sorted(year_count.items()))
    return sorted_year_count


async def fetch_and_count_posts_facebook(keywords):
    """
    Fetches posts for a list of keywords and counts them by year.

    Args:
        keywords (list): A list of keywords to fetch posts for.

    Returns:
        dict: A dictionary with keywords as keys and year counts as values.
    """
    # API connection details
    conn = http.client.HTTPSConnection("facebook-scraper3.p.rapidapi.com")
    headers = {
        'x-rapidapi-key': "84e293cd23msh8690775f2263e8cp1b99ebjsn333d95c46206",
        'x-rapidapi-host': "facebook-scraper3.p.rapidapi.com"
    }

    results = {}

    for query in keywords:
        try:
            # API request for the given keyword
            conn.request("GET", f"/search/posts?query={query}", headers=headers)
            res = conn.getresponse()
            data = res.read()

            # Parse the response data
            response_data = json.loads(data.decode("utf-8"))

            # Count posts by year
            year_counts = count_posts_by_year(response_data)

            # Store the results for this keyword
            results[query] = year_counts

        except Exception as e:
            # Handle any errors for the keyword
            results[query] = {"error": str(e)}

    return results

class KeywordsRequest(BaseModel):
    keywords: List[str]

@app.post("/count_posts_by_year_facebook")
async def get_post_counts_facebook(request: KeywordsRequest):
    """
    Fetches posts for a list of keywords and counts them by year.

    Args:
        keywords (list): A list of keywords to fetch posts for.

    Returns:
        dict: A dictionary with keywords as keys and year counts as values.
    """
    # Fetch and count posts based on the provided keywords
    result = await fetch_and_count_posts_facebook(request.keywords)
    print(result)

    # Return the results
    return result


# Instagram
def count_items_by_year_month(data):
    """
    Counts items based on year and month from the device_timestamp.

    Args:
        data (dict): The parsed JSON response containing the items.

    Returns:
        dict: A dictionary with keys as (year, month) and values as counts.
    """
    grouped_data = defaultdict(int)

    # Loop through each item in the data
    for item in data.get("data", {}).get("items", []):
        timestamp = item.get("device_timestamp")
        if timestamp:
            # Convert timestamp to seconds (assuming timestamp is in microseconds)
            timestamp_seconds = timestamp / 1e6
            date = datetime.fromtimestamp(timestamp_seconds)
            key = (date.year, date.month)
            grouped_data[key] += 1

    # Convert defaultdict to a standard dictionary with formatted keys
    return {f"{year}-{month:02d}": count for (year, month), count in grouped_data.items()}


async def fetch_and_count_keywords_instagram(keywords):
    """
    Fetches data for each keyword and counts items by year and month.

    Args:
        keywords (list): List of hashtags to fetch data for.

    Returns:
        dict: A dictionary with each keyword as a key and counts as values, sorted by date.
    """
    # API connection details
    conn = http.client.HTTPSConnection("instagram-scraper-api2.p.rapidapi.com")
    headers = {
        'x-rapidapi-key': "6496790f8bmsha07b1cf7256f9c2p1995fbjsne7ca8be11817",
        'x-rapidapi-host': "instagram-scraper-api2.p.rapidapi.com"
    }

    results = {}

    for keyword in keywords:
        try:
            # API request for the current keyword
            conn.request("GET", f"/v1/hashtag?hashtag={keyword}", headers=headers)
            res = conn.getresponse()
            data = res.read()

            # Parse the response data
            response_data = json.loads(data.decode("utf-8"))

            # Count items by year and month
            counts = count_items_by_year_month(response_data)

            # Sort the counts by date
            sorted_counts = {k: counts[k] for k in sorted(counts)}

            results[keyword] = sorted_counts
        except Exception as e:
            # Handle any errors and log the issue for the current keyword
            results[keyword] = {"error": str(e)}

    return results


@app.post("/count_items_by_year_month_instagram")
async def get_item_counts_instagram(request: KeywordsRequest):
    """
    Fetches Instagram data for a list of keywords and counts items by year and month.

    Args:
        request (KeywordsRequest): A Pydantic model containing a list of keywords.

    Returns:
        dict: A dictionary with each keyword as a key and counts by year-month as values.
    """
    # Fetch and count items based on the provided keywords
    result = await fetch_and_count_keywords_instagram(request.keywords)

    # Return the results
    return result



# Sales Tea Types (BP1 and PF1)
rf_model_bp1 = joblib.load("sales/tea_types/model_sales_ttbp1v2.joblib")  
rf_model_pf1 = joblib.load("sales/tea_types/model_sales_ttpf1v2.joblib")

class PredictionRequest(BaseModel):
    year: int
    dollar_rate: float
    elevation: str
    # avg_price: float
    sales_code: int
    tea_type: str  # Either 'BP1' or 'PF1'

# Define prediction function
def predict_price(model, year, dollar_rate, elevation, sales_code):
    input_data = np.array([[year, sales_code, dollar_rate, elevation]])
    prediction = model.predict(input_data)
    yr_weights_balance = year - 2020
    final_prediction = prediction[0]

    if(yr_weights_balance > 0):
            final_prediction = final_prediction + (0.1*(final_prediction*yr_weights_balance)/100)
    return final_prediction


@app.post("/predict-sales-unit-price")
async def predict_tea_price(request: PredictionRequest):
    # Select the correct model based on tea type
    if request.tea_type.upper() == "BP1":
        model = rf_model_bp1
    elif request.tea_type.upper() == "PF1":
        model = rf_model_pf1
    else:
        raise HTTPException(status_code=400, detail="Invalid tea type. Choose 'BP1' or 'PF1'.")

    # Make prediction
    elevation_encoded = elevation_map.get(request.elevation, elevation_map['Unknown'])
    predicted_quantity = predict_price(
        model, request.year, request.dollar_rate, elevation_encoded, request.sales_code
    )

    return {"tea_type": request.tea_type, "predicted_unit": predicted_quantity}

# Image processing

# Find Plant
def load_model_with_custom_objects(model_path, custom_objects=None):
    model = tf.keras.models.load_model(model_path, custom_objects=custom_objects)
    return model

def check_plant(model, image_path):
    # Open the image and preprocess it
    img = Image.open(image_path)
    img = img.resize((48, 48))  
    img = np.array(img)  
    img = img / 255.0  
    
    # Make prediction
    prediction = model.predict(np.expand_dims(img, axis=0))
    predicted_class_index = np.argmax(prediction)
    class_names = ['Type 25', 'Type 26', 'Type Purple']
    predicted_class = class_names[predicted_class_index]
    
    return predicted_class

@app.post("/predict-tea-plant")
async def upload_image(file: UploadFile = File(...)):
    try:
        # Save the uploaded file
        file_path = f"{UPLOADS_DIR}/{file.filename}"
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Load the model
        model_path = 'model_plant.h5'
        model = load_model_with_custom_objects(model_path, custom_objects=None)

        # Make prediction
        predicted_class = check_plant(model, file_path)
        
        return {"predicted_class": predicted_class}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

def check_disease(model, image_path):
    # Open the image and preprocess it
    img = Image.open(image_path)
    
    # Convert to RGB if image has alpha channel (4 channels)
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    
    img = img.resize((48, 48))  
    img = np.array(img)  
    img = img / 255.0  
    
    # Make prediction
    prediction = model.predict(np.expand_dims(img, axis=0))
    predicted_class_index = np.argmax(prediction)
    class_names = ['anthracnose', 'brown blight', 'bird eye spot', 'white spot', 
                  'gray light', 'healthy', 'red leaf spot', 'algal leaf']
    predicted_class = class_names[predicted_class_index]
    
    return predicted_class

@app.post("/predict-tea-disease")
async def predict_disease(file: UploadFile = File(...)):
    try:
        # Save the uploaded file
        file_path = f"{UPLOADS_DIR}/{file.filename}"
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Load the disease model (assuming you have a different model for diseases)
        model_path = 'model_tea_diseases.h5'  # or whatever your disease model path is
        model = load_model_with_custom_objects(model_path, custom_objects=None)

        # Make prediction
        predicted_disease = check_disease(model, file_path)
        
        return {"predicted_disease": predicted_disease}
    except Exception as e:
        error_message = traceback.format_exc()
        print(error_message)
        return JSONResponse(content={"error": str(e)}, status_code=500)