
import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

URI = os.getenv("NEO4J_URI")
USERNAME = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")
DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

if not URI or not USERNAME or not PASSWORD:
    raise ValueError(
        "Neo4j configuration missing. Check backend/.env"
    )

driver = GraphDatabase.driver(
    URI,
    auth=(USERNAME, PASSWORD)
)

def get_driver():
    return driver
