#!/bin/bash
uvicorn model_api:app --host 0.0.0.0 --port $PORT