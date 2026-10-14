from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
import random
from fastapi_mcp import FastApiMCP # module for MCP support
import json
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Middleware to handle CORS (Cross-Origin Resource Sharing)
# This allows the API to be accessed from different origins, such as a frontend application.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database simulation
db = []

class SystemCreate(BaseModel):
    """
    A Pydantic model representing the data required to create a new system entry.

    Attributes:
        system_name: The name of the system.
        system_description: A brief description of the system.
        business_steward_email: The email address of the business steward.
        business_steward_full_name: The full name of the business steward.
        security_steward_email: The email address of the security steward.
        security_steward_full_name: The full name of the security steward.
        technical_steward_email: The email address of the technical steward.
        technical_steward_full_name: The full name of the technical steward.
    """
    system_name: str
    system_description: str
    business_steward_email: EmailStr
    business_steward_full_name: str
    security_steward_email: EmailStr
    security_steward_full_name: str
    technical_steward_email: EmailStr
    technical_steward_full_name: str

class System(SystemCreate):
    """
    A Pydantic model that extends SystemCreate with a system ID, representing a system entry in the database.

    Attributes:
        Inherits all attributes from SystemCreate.
        system_id: A unique identifier for the system.
    """
    system_id: int

try:
    with open("db_data.json", "r") as json_file:
         db = [System(**item) for item in json.load(json_file)]   
except FileNotFoundError:    
     db = []  # Initialize an empty list if the file does not exist



def save_system_to_db(system_create: SystemCreate) -> System:
    """
    Simulates saving a system entry to a database by generating a random system_id and appending it to a mock database.

    Args:
        system_create: An instance of SystemCreate containing the system's creation data.

    Returns:
        An instance of System containing the newly created system's data, including its system_id.
    """
    # Simulate saving to a database by generating a random system_id
    system_id = random.randint(100, 10000)  # Randomly generate a system_id
    system = System(system_id=system_id, **system_create.dict())
    db.append(system)  # Simulate saving to a database
    with open("db_data.json", "w") as json_file:
        json.dump([system.dict() for system in db], json_file, indent=4)
    return system

@app.post("/systems/", response_model=System, status_code=status.HTTP_201_CREATED)
async def create_system(system_create: SystemCreate):
    """
    Endpoint for creating a new system entry. It receives system creation data, saves it to a mock database, and returns the created system.

    Args:
        system_create: An instance of SystemCreate received from the request body, containing the data needed to create a new system.

    Returns:
        An instance of System, representing the newly created system entry.
    """
    system = save_system_to_db(system_create)
    return system

@app.get("/systems/{system_id}", response_model=System, operation_id="get_system_by_id", summary="Get System by ID", description="Retrieves a specific system by its system_id.")
async def get_system(system_id: int):
    """
    Endpoint for retrieving a specific system by its system_id.

    Args:
        system_id: An integer representing the unique identifier of the system to be retrieved.

    Returns:
        An instance of System, representing the system entry with the matching system_id.

    Raises:
        HTTPException: A 404 Not Found error if a system with the specified system_id is not found in the database.
    """
    for system in db:
        if system.system_id == system_id:
            return system
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System not found")

@app.get("/systems/", response_model=list[System], operation_id="get_all_systems", summary="Get All Systems", description="Retrieves all systems stored in enterprise catalog.")
async def get_all_systems():
    """
    Endpoint for retrieving all systems in the database.

    Returns:
        A list of System instances, representing all the system entries in the database.
        If there are no systems, returns an empty list.
    """
    try:
        with open("db_data.json", "r") as json_file:
            db = [System(**item) for item in json.load(json_file)]
    except FileNotFoundError:
        db = []
    return db

# This is the main API app that provides endpoints for creating and retrieving systems.
# Let's expose the API through MCP endpoint so that the operations can be accessed by MCP clients/proxy using LangChain MCP adapter.
# It is done by creating a separate FastAPI app for MCP
mcp_app = FastAPI()
# Create MCP server from the API app

mcp = FastApiMCP(app,  # the API app
                 # base_url="http://127.0.0.1:8000/",  # URL where the API app will be running
                name="Systems Catalog API MCP",  # Give your MCP server a name
                description="This is the MCP Server endpoint for Systems Catalog API",  # Provide a description for the API
                include_operations=["get_system_by_id", "get_all_systems"]  # Include only the read operations in MCP
                )
# Mount the MCP server to the separate app  
mcp.mount(mcp_app)

# Now run both apps separately:
# uvicorn main:app --host 127.0.0.1 --port 8000
# uvicorn main:mcp_app --host 127.0.0.1 --port 8001

