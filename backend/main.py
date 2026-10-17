from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from database import driver
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import datetime

app = FastAPI(
    title="TRACE-X API",
    description="TRACE-X AI-Powered Criminal Network Intelligence System API",
    version="3.0"
)

# Allow React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_LABELS = ["Person", "Case", "Location", "Vehicle", "Phone"]
DEFAULT_INV_ID = "INV-DEMO-001"


# --------------------------------------------------
# PYDANTIC MODELS FOR INGESTION & VALIDATION
# --------------------------------------------------

class PersonInput(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    age: Optional[int] = None
    gender: Optional[str] = None
    aliases: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "Active"

class PhoneInput(BaseModel):
    id: str = Field(..., min_length=1)
    number: str = Field(..., min_length=1)
    carrier: Optional[str] = None
    notes: Optional[str] = None

class VehicleInput(BaseModel):
    id: str = Field(..., min_length=1)
    registration_number: Optional[str] = None
    type: Optional[str] = "Vehicle"
    model: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None

class CaseInput(BaseModel):
    id: str = Field(..., min_length=1)
    name: Optional[str] = None
    type: Optional[str] = "Crime Incident"
    date: Optional[str] = None
    status: Optional[str] = "Under Investigation"
    location: Optional[str] = None
    notes: Optional[str] = None

class LocationInput(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    type: Optional[str] = "Hotspot"

class RelationshipInput(BaseModel):
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    notes: Optional[str] = None

class InvestigationCreateInput(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1)
    description: Optional[str] = ""

class ImportPayload(BaseModel):
    people: List[PersonInput] = []
    phones: List[PhoneInput] = []
    vehicles: List[VehicleInput] = []
    cases: List[CaseInput] = []
    locations: List[LocationInput] = []
    relationships: List[RelationshipInput] = []


# --------------------------------------------------
# STARTUP INITIALIZATION & DEMO DATA MIGRATION
# --------------------------------------------------

@app.on_event("startup")
def initialize_database():
    """Ensure Demo Investigation exists and tag existing nodes without an investigation_id."""
    try:
        with driver.session(database="neo4j") as session:
            # 1. Create or ensure Demo Investigation node exists
            session.run(
                """
                MERGE (inv:Investigation {id: $default_id})
                ON CREATE SET
                    inv.name = 'Demo Investigation (Syndicate Alpha)',
                    inv.description = 'Pre-configured syndicate network for presentation and testing',
                    inv.created_at = '2026-08-24T00:00:00Z'
                """,
                default_id=DEFAULT_INV_ID
            )

            # 2. Tag existing nodes that have no investigation_id with DEFAULT_INV_ID
            for label in VALID_LABELS:
                session.run(
                    f"""
                    MATCH (n:{label})
                    WHERE n.investigation_id IS NULL
                    SET n.investigation_id = $default_id
                    """,
                    default_id=DEFAULT_INV_ID
                )
    except Exception as e:
        print(f"Database initialization warning: {e}")


# --------------------------------------------------
# HOME & HEALTH
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "status": "online",
        "system": "TRACE-X API",
        "version": "3.0"
    }

@app.get("/test-db")
def test_database():
    try:
        with driver.session(database="neo4j") as session:
            result = session.run("RETURN 'Neo4j connection successful!' AS message")
            record = result.single()
            return {
                "status": "success",
                "message": record["message"]
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# --------------------------------------------------
# INVESTIGATION MANAGEMENT
# --------------------------------------------------

@app.get("/investigations")
def get_investigations():
    try:
        with driver.session(database="neo4j") as session:
            query = """
            MATCH (inv:Investigation)
            OPTIONAL MATCH (n)
            WHERE size(labels(n)) > 0 AND labels(n)[0] IN $valid_labels AND n.investigation_id = inv.id
            WITH inv, count(DISTINCT n) AS node_count,
                 count(DISTINCT CASE WHEN 'Person' IN labels(n) THEN n END) AS person_count,
                 count(DISTINCT CASE WHEN 'Case' IN labels(n) THEN n END) AS case_count
            OPTIONAL MATCH (a)-[r]->(b)
            WHERE a.investigation_id = inv.id AND b.investigation_id = inv.id
            RETURN
                inv.id AS id,
                inv.name AS name,
                inv.description AS description,
                inv.created_at AS created_at,
                node_count,
                person_count,
                case_count,
                count(DISTINCT r) AS rel_count
            ORDER BY inv.created_at DESC, inv.id
            """
            result = session.run(query, valid_labels=VALID_LABELS)
            investigations = []
            for r in result:
                investigations.append({
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"] or "",
                    "created_at": r["created_at"] or datetime.datetime.utcnow().isoformat(),
                    "node_count": r["node_count"],
                    "person_count": r["person_count"],
                    "case_count": r["case_count"],
                    "rel_count": r["rel_count"]
                })
            return {
                "count": len(investigations),
                "investigations": investigations
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/investigations")
def create_investigation(payload: InvestigationCreateInput):
    try:
        inv_id = payload.id
        if not inv_id or not inv_id.strip():
            timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
            inv_id = f"INV-{timestamp}"
        else:
            inv_id = inv_id.strip().upper()

        now = datetime.datetime.utcnow().isoformat()

        with driver.session(database="neo4j") as session:
            # Check if ID already exists
            existing = session.run("MATCH (inv:Investigation {id: $id}) RETURN inv.id", id=inv_id).single()
            if existing:
                raise HTTPException(status_code=400, detail=f"Investigation with ID '{inv_id}' already exists.")

            session.run(
                """
                CREATE (inv:Investigation {
                    id: $id,
                    name: $name,
                    description: $description,
                    created_at: $created_at
                })
                """,
                id=inv_id,
                name=payload.name,
                description=payload.description or "",
                created_at=now
            )

        return {
            "success": True,
            "investigation": {
                "id": inv_id,
                "name": payload.name,
                "description": payload.description or "",
                "created_at": now,
                "node_count": 0,
                "rel_count": 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/investigations/{inv_id}")
def delete_investigation(inv_id: str):
    try:
        with driver.session(database="neo4j") as session:
            # Check existence
            inv = session.run("MATCH (inv:Investigation {id: $id}) RETURN inv", id=inv_id).single()
            if not inv:
                raise HTTPException(status_code=404, detail="Investigation not found.")

            # Delete all entities and relationships tagged with this investigation
            delete_query = """
            MATCH (n)
            WHERE n.investigation_id = $id
            DETACH DELETE n
            """
            session.run(delete_query, id=inv_id)

            # Delete the investigation node
            session.run("MATCH (inv:Investigation {id: $id}) DETACH DELETE inv", id=inv_id)

            return {
                "success": True,
                "message": f"Investigation '{inv_id}' and all associated nodes/relationships were deleted."
            }
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# VALIDATION ENDPOINT
# --------------------------------------------------

@app.post("/investigations/validate")
def validate_investigation_data(payload: ImportPayload):
    """
    Pre-import validation engine:
    - Checks duplicate IDs across entities
    - Identifies missing fields
    - Verifies all relationship source and target IDs exist in the payload or database
    """
    errors = []
    warnings = []

    entity_ids = set()
    id_type_map = {}

    # 1. Validate People
    for idx, p in enumerate(payload.people):
        p_id = str(p.id).strip()
        if not p_id:
            errors.append(f"Person #{idx + 1}: Missing Person ID.")
        elif p_id in entity_ids:
            errors.append(f"Person '{p_id}': Duplicate ID (already used as {id_type_map.get(p_id, 'Entity')}).")
        else:
            entity_ids.add(p_id)
            id_type_map[p_id] = "Person"

        if not p.name or not str(p.name).strip():
            errors.append(f"Person '{p_id}': Name is required.")

    # 2. Validate Phones
    for idx, ph in enumerate(payload.phones):
        ph_id = str(ph.id).strip()
        if not ph_id:
            errors.append(f"Phone #{idx + 1}: Missing Phone ID.")
        elif ph_id in entity_ids:
            errors.append(f"Phone '{ph_id}': Duplicate ID (already used as {id_type_map.get(ph_id, 'Entity')}).")
        else:
            entity_ids.add(ph_id)
            id_type_map[ph_id] = "Phone"

        if not ph.number or len(str(ph.number).strip()) < 3:
            warnings.append(f"Phone '{ph_id}': Phone number '{ph.number}' seems unusually short.")

    # 3. Validate Vehicles
    for idx, v in enumerate(payload.vehicles):
        v_id = str(v.id).strip()
        if not v_id:
            errors.append(f"Vehicle #{idx + 1}: Missing Vehicle ID.")
        elif v_id in entity_ids:
            errors.append(f"Vehicle '{v_id}': Duplicate ID (already used as {id_type_map.get(v_id, 'Entity')}).")
        else:
            entity_ids.add(v_id)
            id_type_map[v_id] = "Vehicle"

    # 4. Validate Cases
    for idx, c in enumerate(payload.cases):
        c_id = str(c.id).strip()
        if not c_id:
            errors.append(f"Case #{idx + 1}: Missing Case ID.")
        elif c_id in entity_ids:
            errors.append(f"Case '{c_id}': Duplicate ID (already used as {id_type_map.get(c_id, 'Entity')}).")
        else:
            entity_ids.add(c_id)
            id_type_map[c_id] = "Case"

    # 5. Validate Locations
    for idx, l in enumerate(payload.locations):
        l_id = str(l.id).strip()
        if not l_id:
            errors.append(f"Location #{idx + 1}: Missing Location ID.")
        elif l_id in entity_ids:
            errors.append(f"Location '{l_id}': Duplicate ID (already used as {id_type_map.get(l_id, 'Entity')}).")
        else:
            entity_ids.add(l_id)
            id_type_map[l_id] = "Location"

        if l.latitude is not None and (l.latitude < -90 or l.latitude > 90):
            errors.append(f"Location '{l_id}': Latitude {l.latitude} is out of range (-90 to 90).")
        if l.longitude is not None and (l.longitude < -180 or l.longitude > 180):
            errors.append(f"Location '{l_id}': Longitude {l.longitude} is out of range (-180 to 180).")

    # 6. Validate Relationships
    for idx, r in enumerate(payload.relationships):
        src = str(r.source).strip()
        tgt = str(r.target).strip()
        rel_type = str(r.type).strip().upper()

        if not src or not tgt:
            errors.append(f"Relationship #{idx + 1}: Source and Target must not be empty.")
            continue

        if not rel_type:
            errors.append(f"Relationship #{idx + 1} ({src} -> {tgt}): Missing relationship type.")

        if src not in entity_ids:
            errors.append(f"Relationship #{idx + 1}: Source ID '{src}' does not match any entity in this dataset.")

        if tgt not in entity_ids:
            errors.append(f"Relationship #{idx + 1}: Target ID '{tgt}' does not match any entity in this dataset.")

        if src == tgt:
            warnings.append(f"Relationship #{idx + 1}: Self-referencing link on entity '{src}'.")

    summary = {
        "people_count": len(payload.people),
        "phones_count": len(payload.phones),
        "vehicles_count": len(payload.vehicles),
        "cases_count": len(payload.cases),
        "locations_count": len(payload.locations),
        "relationships_count": len(payload.relationships),
        "total_entities": len(entity_ids),
        "errors_count": len(errors),
        "warnings_count": len(warnings)
    }

    return {
        "valid": len(errors) == 0,
        "summary": summary,
        "errors": errors,
        "warnings": warnings
    }


# --------------------------------------------------
# IMPORT INGESTION ENDPOINT
# --------------------------------------------------

@app.post("/investigations/{inv_id}/import")
def import_investigation_data(inv_id: str, payload: ImportPayload):
    try:
        with driver.session(database="neo4j") as session:
            # Ensure investigation node exists
            session.run(
                """
                MERGE (inv:Investigation {id: $id})
                ON CREATE SET
                    inv.name = $name,
                    inv.created_at = $created_at,
                    inv.description = 'Imported Investigation'
                """,
                id=inv_id,
                name=f"Investigation {inv_id}",
                created_at=datetime.datetime.utcnow().isoformat()
            )

            # 1. Ingest People
            for p in payload.people:
                session.run(
                    """
                    MERGE (p:Person {id: $id, investigation_id: $inv_id})
                    SET p.name = $name,
                        p.age = $age,
                        p.gender = $gender,
                        p.aliases = $aliases,
                        p.notes = $notes,
                        p.status = $status
                    """,
                    id=str(p.id).strip(),
                    inv_id=inv_id,
                    name=str(p.name).strip(),
                    age=p.age,
                    gender=p.gender,
                    aliases=p.aliases,
                    notes=p.notes,
                    status=p.status
                )

            # 2. Ingest Phones
            for ph in payload.phones:
                session.run(
                    """
                    MERGE (ph:Phone {id: $id, investigation_id: $inv_id})
                    SET ph.number = $number,
                        ph.carrier = $carrier,
                        ph.notes = $notes
                    """,
                    id=str(ph.id).strip(),
                    inv_id=inv_id,
                    number=str(ph.number).strip(),
                    carrier=ph.carrier,
                    notes=ph.notes
                )

            # 3. Ingest Vehicles
            for v in payload.vehicles:
                reg_num = str(v.registration_number or v.id).strip()
                session.run(
                    """
                    MERGE (v:Vehicle {id: $id, investigation_id: $inv_id})
                    SET v.number = $reg_num,
                        v.registration_number = $reg_num,
                        v.type = $type,
                        v.model = $model,
                        v.color = $color,
                        v.notes = $notes
                    """,
                    id=str(v.id).strip(),
                    inv_id=inv_id,
                    reg_num=reg_num,
                    type=v.type or "Vehicle",
                    model=v.model,
                    color=v.color,
                    notes=v.notes
                )

            # 4. Ingest Cases
            for c in payload.cases:
                session.run(
                    """
                    MERGE (c:Case {id: $id, investigation_id: $inv_id})
                    SET c.name = $name,
                        c.type = $type,
                        c.date = $date,
                        c.status = $status,
                        c.location = $location,
                        c.notes = $notes
                    """,
                    id=str(c.id).strip(),
                    inv_id=inv_id,
                    name=str(c.name or f"Case {c.id}").strip(),
                    type=c.type or "Crime Incident",
                    date=c.date,
                    status=c.status or "Under Investigation",
                    location=c.location,
                    notes=c.notes
                )

            # 5. Ingest Locations
            for l in payload.locations:
                session.run(
                    """
                    MERGE (loc:Location {id: $id, investigation_id: $inv_id})
                    SET loc.name = $name,
                        loc.address = $address,
                        loc.latitude = $latitude,
                        loc.longitude = $longitude,
                        loc.type = $type
                    """,
                    id=str(l.id).strip(),
                    inv_id=inv_id,
                    name=str(l.name).strip(),
                    address=l.address,
                    latitude=l.latitude,
                    longitude=l.longitude,
                    type=l.type or "Hotspot"
                )

            # 6. Ingest Relationships
            for r in payload.relationships:
                rel_type = str(r.type).strip().replace(" ", "_").upper()
                if not rel_type:
                    rel_type = "CONNECTED_TO"

                # Dynamic Cypher relationship creation with sanitized type
                cypher_rel = f"""
                MATCH (a {{id: $source_id, investigation_id: $inv_id}})
                MATCH (b {{id: $target_id, investigation_id: $inv_id}})
                MERGE (a)-[r:{rel_type}]->(b)
                SET r.notes = $notes
                """
                session.run(
                    cypher_rel,
                    source_id=str(r.source).strip(),
                    target_id=str(r.target).strip(),
                    inv_id=inv_id,
                    notes=r.notes
                )

            return {
                "success": True,
                "investigation_id": inv_id,
                "imported": {
                    "people": len(payload.people),
                    "phones": len(payload.phones),
                    "vehicles": len(payload.vehicles),
                    "cases": len(payload.cases),
                    "locations": len(payload.locations),
                    "relationships": len(payload.relationships)
                }
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# CSV TEMPLATES HELPER
# --------------------------------------------------

@app.get("/investigations/templates/csv/{entity_type}")
def get_csv_template(entity_type: str):
    templates = {
        "people": "id,name,age,gender,aliases,notes,status\nCR101,Vikram Roy,42,Male,The Viper,Principal financier,Active\nCR102,Karan Mehta,35,Male,Shadow,Logistics coordinator,Active",
        "phones": "id,number,carrier,notes\nPH001,+91-9876543210,Airtel,Burn phone intercept\nPH002,+91-9123456780,Jio,Encrypted communications",
        "vehicles": "id,registration_number,type,model,color,notes\nVH001,DL-01-AB-1234,Sedan,Honda City,Black,Observed near crime scene\nVH002,MH-02-XY-9876,SUV,Toyota Fortuner,White,Getaway vehicle",
        "cases": "id,name,type,date,status,location,notes\nCASE-201,Downtown Bank Heist,Armed Robbery,2026-03-15,Under Investigation,Connaught Place,Armed syndicate robbery\nCASE-202,Port Warehouse Smuggling,Contraband Smuggling,2026-04-10,Active,Nhava Sheva Port,Narcotics transit",
        "locations": "id,name,address,latitude,longitude,type\nLOC01,Central Safehouse,Block B Sector 14,28.6139,77.2090,Safehouse\nLOC02,Old Mill Drop Site,Industrial Zone,28.6353,77.2250,Drop Site",
        "relationships": "source,target,type,notes\nCR101,CASE-201,INVOLVED_IN,Primary suspect\nCR101,PH001,USES,Registered burner line\nCR102,VH001,USES_VEHICLE,Driver\nCASE-201,LOC01,OCCURRED_AT,Primary incident site\nCR101,CR102,ASSOCIATED_WITH,Direct accomplice"
    }
    content = templates.get(entity_type.lower())
    if not content:
        raise HTTPException(status_code=404, detail="Template type not found. Use people, phones, vehicles, cases, locations, or relationships.")
    return {"type": entity_type, "csv": content}


# --------------------------------------------------
# DATABASE STATISTICS (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/stats")
def get_stats(investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "WHERE p.investigation_id = $inv_id" if investigation_id else ""
            params = {"inv_id": investigation_id} if investigation_id else {}

            persons = session.run(
                f"MATCH (p:Person) {inv_filter} RETURN count(p) AS count",
                **params
            ).single()["count"]

            cases = session.run(
                f"MATCH (c:Case) {'WHERE c.investigation_id = $inv_id' if investigation_id else ''} RETURN count(c) AS count",
                **params
            ).single()["count"]

            locations = session.run(
                f"MATCH (l:Location) {'WHERE l.investigation_id = $inv_id' if investigation_id else ''} RETURN count(l) AS count",
                **params
            ).single()["count"]

            vehicles = session.run(
                f"MATCH (v:Vehicle) {'WHERE v.investigation_id = $inv_id' if investigation_id else ''} RETURN count(v) AS count",
                **params
            ).single()["count"]

            phones = session.run(
                f"MATCH (p:Phone) {'WHERE p.investigation_id = $inv_id' if investigation_id else ''} RETURN count(p) AS count",
                **params
            ).single()["count"]

            rel_query = """
            MATCH (a)-[r]->(b)
            WHERE size(labels(a)) > 0 AND size(labels(b)) > 0
            """ + (f" AND a.investigation_id = $inv_id AND b.investigation_id = $inv_id" if investigation_id else "") + " RETURN count(r) AS count"

            relationships = session.run(rel_query, **params).single()["count"]

            return {
                "persons": persons,
                "cases": cases,
                "locations": locations,
                "vehicles": vehicles,
                "phones": phones,
                "relationships": relationships
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# GET ALL PERSONS (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/persons")
def get_persons(investigation_id: Optional[str] = Query(None)):
    query = """
    MATCH (p:Person)
    """ + (f"WHERE p.investigation_id = $inv_id " if investigation_id else "") + """
    OPTIONAL MATCH (p)-[r]-(connected)
    WHERE size(labels(connected)) > 0 """ + (f"AND connected.investigation_id = p.investigation_id " if investigation_id else "") + """
    WITH p, count(r) AS connections_count,
         count(DISTINCT CASE WHEN 'Case' IN labels(connected) THEN connected END) AS cases_count,
         count(DISTINCT CASE WHEN 'Phone' IN labels(connected) THEN connected END) AS phones_count,
         count(DISTINCT CASE WHEN 'Vehicle' IN labels(connected) THEN connected END) AS vehicles_count
    RETURN p.id AS id,
           p.name AS name,
           p.age AS age,
           p.investigation_id AS investigation_id,
           connections_count,
           cases_count,
           phones_count,
           vehicles_count
    ORDER BY connections_count DESC, p.id
    """
    try:
        with driver.session(database="neo4j") as session:
            params = {"inv_id": investigation_id} if investigation_id else {}
            result = session.run(query, **params)
            persons = []
            for record in result:
                connections = record["connections_count"]
                cases = record["cases_count"]
                phones = record["phones_count"]
                vehicles = record["vehicles_count"]

                risk_score = min(100, (connections * 12) + (cases * 15) + (phones * 5) + (vehicles * 5))
                if risk_score >= 70:
                    risk_level = "HIGH"
                elif risk_score >= 40:
                    risk_level = "MEDIUM"
                else:
                    risk_level = "LOW"

                persons.append({
                    "id": record["id"],
                    "name": record["name"],
                    "age": record["age"],
                    "investigation_id": record["investigation_id"],
                    "connections_count": connections,
                    "cases_count": cases,
                    "phones_count": phones,
                    "vehicles_count": vehicles,
                    "risk_score": risk_score,
                    "risk_level": risk_level
                })

            return {
                "count": len(persons),
                "persons": persons
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# GET PERSON DETAILS
# --------------------------------------------------

@app.get("/person/{person_id}")
def get_person(person_id: str, investigation_id: Optional[str] = Query(None)):
    query = """
    MATCH (p:Person {id: $person_id})
    """ + (f"WHERE p.investigation_id = $inv_id " if investigation_id else "") + """
    RETURN p.id AS id,
           p.name AS name,
           p.age AS age,
           p.investigation_id AS investigation_id,
           p.gender AS gender,
           p.aliases AS aliases,
           p.notes AS notes,
           p.status AS status
    """
    try:
        with driver.session(database="neo4j") as session:
            params = {"person_id": person_id}
            if investigation_id:
                params["inv_id"] = investigation_id

            result = session.run(query, **params)
            record = result.single()

            if record is None:
                return {
                    "status": "not_found",
                    "message": "Person not found"
                }

            return {
                "id": record["id"],
                "name": record["name"],
                "age": record["age"],
                "investigation_id": record["investigation_id"],
                "gender": record["gender"],
                "aliases": record["aliases"],
                "notes": record["notes"],
                "status": record["status"] or "Active"
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# GET NETWORK OF A PERSON (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/network/{person_id}")
def get_network(person_id: str, investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            params = {"person_id": person_id}
            if investigation_id:
                params["inv_id"] = investigation_id

            person_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                RETURN p.id AS id, p.name AS name, p.age AS age, p.investigation_id AS inv_id
                """,
                **params
            )
            person_record = person_result.single()

            if person_record is None:
                return {
                    "status": "not_found",
                    "message": "Person not found"
                }

            inv_filter = "AND entity.investigation_id = p.investigation_id" if investigation_id else ""
            result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                OPTIONAL MATCH (p)-[r1]-(entity)
                WHERE size(labels(entity)) > 0 {inv_filter}
                OPTIONAL MATCH (entity)-[r2]-(other:Person)
                WHERE other.id <> $person_id {('AND other.investigation_id = p.investigation_id' if investigation_id else '')}

                RETURN
                    p.id AS source_id,
                    entity.id AS entity_id,
                    entity.name AS entity_name,
                    entity.number AS entity_number,
                    entity.type AS entity_type_prop,
                    entity.latitude AS entity_lat,
                    entity.longitude AS entity_lng,
                    entity.date AS entity_date,
                    labels(entity) AS entity_labels,
                    type(r1) AS relationship_to_entity,
                    other.id AS other_person_id,
                    other.name AS other_person_name,
                    other.age AS other_person_age,
                    type(r2) AS relationship_to_other
                """,
                **params
            )

            nodes = []
            relationships = []

            nodes.append({
                "id": str(person_record["id"]),
                "label": str(person_record["name"]),
                "type": "Person",
                "properties": {
                    "id": person_record["id"],
                    "name": person_record["name"],
                    "age": person_record["age"]
                }
            })

            for record in result:
                entity_id = record["entity_id"] or record["entity_number"] or record["entity_name"]
                entity_labels = record["entity_labels"]

                if entity_id is not None and entity_labels:
                    entity_type = entity_labels[0]
                    entity_label = (
                        record["entity_name"]
                        or record["entity_number"]
                        or record["entity_type_prop"]
                        or entity_id
                    )

                    entity_props = {
                        "id": str(entity_id),
                        "label": str(entity_label),
                        "type": entity_type
                    }
                    if record["entity_lat"] is not None:
                        entity_props["latitude"] = record["entity_lat"]
                        entity_props["longitude"] = record["entity_lng"]
                    if record["entity_date"] is not None:
                        entity_props["date"] = record["entity_date"]
                    if record["entity_type_prop"] is not None:
                        entity_props["type_category"] = record["entity_type_prop"]

                    nodes.append({
                        "id": str(entity_id),
                        "label": str(entity_label),
                        "type": str(entity_type),
                        "properties": entity_props
                    })

                    if record["relationship_to_entity"]:
                        relationships.append({
                            "source": str(person_id),
                            "target": str(entity_id),
                            "type": str(record["relationship_to_entity"])
                        })

                other_person_id = record["other_person_id"]
                if other_person_id is not None:
                    nodes.append({
                        "id": str(other_person_id),
                        "label": str(record["other_person_name"]),
                        "type": "Person",
                        "properties": {
                            "id": other_person_id,
                            "name": record["other_person_name"],
                            "age": record["other_person_age"]
                        }
                    })

                    if entity_id is not None and record["relationship_to_other"]:
                        relationships.append({
                            "source": str(entity_id),
                            "target": str(other_person_id),
                            "type": str(record["relationship_to_other"])
                        })

            unique_nodes = {node["id"]: node for node in nodes}
            unique_relationships = []
            seen_relationships = set()
            for rel in relationships:
                key = (rel["source"], rel["target"], rel["type"])
                if key not in seen_relationships:
                    seen_relationships.add(key)
                    unique_relationships.append(rel)

            return {
                "person": person_id,
                "nodes": list(unique_nodes.values()),
                "relationships": unique_relationships
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# NETWORK INSIGHTS (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/insights/{person_id}")
def get_insights(person_id: str, investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            params = {"person_id": person_id}
            if investigation_id:
                params["inv_id"] = investigation_id

            person_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                RETURN p.id AS id, p.name AS name
                """,
                **params
            )
            person = person_result.single()

            if person is None:
                return {
                    "status": "not_found",
                    "message": "Person not found"
                }

            inv_filter = "AND connected.investigation_id = p.investigation_id" if investigation_id else ""
            network_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[r]-(connected)
                WHERE size(labels(connected)) > 0 {inv_filter}
                RETURN
                    type(r) AS relationship,
                    labels(connected)[0] AS target_type,
                    count(*) AS total
                ORDER BY total DESC
                """,
                **params
            )

            connections = []
            for record in network_result:
                connections.append({
                    "relationship": record["relationship"],
                    "target_type": record["target_type"],
                    "count": record["total"]
                })

            people_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[*1..2]-(other:Person)
                WHERE other.id <> $person_id {('AND other.investigation_id = p.investigation_id' if investigation_id else '')}
                RETURN count(DISTINCT other) AS count
                """,
                **params
            )
            connected_people = people_result.single()["count"]

            cases_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[*1..2]-(c:Case)
                WHERE {('c.investigation_id = p.investigation_id' if investigation_id else 'true')}
                RETURN count(DISTINCT c) AS count
                """,
                **params
            )
            cases = cases_result.single()["count"]

            phones_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[*1..2]-(phone:Phone)
                WHERE {('phone.investigation_id = p.investigation_id' if investigation_id else 'true')}
                RETURN count(DISTINCT phone) AS count
                """,
                **params
            )
            phones = phones_result.single()["count"]

            vehicles_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[*1..2]-(vehicle:Vehicle)
                WHERE {('vehicle.investigation_id = p.investigation_id' if investigation_id else 'true')}
                RETURN count(DISTINCT vehicle) AS count
                """,
                **params
            )
            vehicles = vehicles_result.single()["count"]

            locations_result = session.run(
                f"""
                MATCH (p:Person {{id: $person_id}})
                {'WHERE p.investigation_id = $inv_id' if investigation_id else ''}
                MATCH (p)-[*1..3]-(location:Location)
                WHERE {('location.investigation_id = p.investigation_id' if investigation_id else 'true')}
                RETURN count(DISTINCT location) AS count
                """,
                **params
            )
            locations = locations_result.single()["count"]

            total_connections = sum(item["count"] for item in connections)

            risk_indicators = []
            if connected_people >= 2:
                risk_indicators.append("Connected to multiple persons in syndicate")
            if cases >= 2:
                risk_indicators.append("Linked to multiple active criminal cases")
            if phones >= 2:
                risk_indicators.append("Operates multiple burn/communication phone lines")
            if vehicles >= 2:
                risk_indicators.append("Associated with multiple getaway/transport vehicles")
            if locations >= 2:
                risk_indicators.append("Cross-jurisdictional geographic footprint")

            risk_score = min(100, (connected_people * 15) + (cases * 15) + (phones * 8) + (vehicles * 8) + (locations * 6))

            if risk_score >= 70:
                risk_level = "HIGH"
            elif risk_score >= 40:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            return {
                "person": person_id,
                "person_name": person["name"],
                "total_connections": total_connections,
                "connected_people": connected_people,
                "cases": cases,
                "phones": phones,
                "vehicles": vehicles,
                "locations": locations,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "risk_indicators": risk_indicators,
                "connections": connections
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# SHARED ENTITY DETECTION
# --------------------------------------------------

@app.get("/shared/{person1_id}/{person2_id}")
def get_shared_entities(person1_id: str, person2_id: str, investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "AND p1.investigation_id = $inv_id AND p2.investigation_id = $inv_id AND shared.investigation_id = $inv_id" if investigation_id else ""
            params = {"person1_id": person1_id, "person2_id": person2_id}
            if investigation_id:
                params["inv_id"] = investigation_id

            query = f"""
            MATCH (p1:Person {{id: $person1_id}})
            MATCH (p2:Person {{id: $person2_id}})
            MATCH (p1)-[]-(shared)-[]-(p2)
            WHERE NOT shared:Person AND size(labels(shared)) > 0 {inv_filter}
            RETURN
                labels(shared)[0] AS entity_type,
                shared.id AS entity_id,
                shared.name AS entity_name,
                shared.number AS entity_number,
                shared.type AS entity_type_prop
            """
            result = session.run(query, **params)

            shared_entities = []
            for record in result:
                entity_id = record["entity_id"] or record["entity_number"] or record["entity_name"]
                display_value = (
                    record["entity_name"]
                    or record["entity_number"]
                    or record["entity_type_prop"]
                    or entity_id
                )

                shared_entities.append({
                    "type": record["entity_type"],
                    "id": str(entity_id),
                    "value": str(display_value)
                })

            unique_entities = []
            seen = set()
            for entity in shared_entities:
                key = (entity["type"], entity["id"])
                if key not in seen:
                    seen.add(key)
                    unique_entities.append(entity)

            shared_count = len(unique_entities)
            strength = "HIGH" if shared_count >= 3 else ("MEDIUM" if shared_count == 2 else ("LOW" if shared_count == 1 else "NONE"))

            return {
                "person1": person1_id,
                "person2": person2_id,
                "shared_count": shared_count,
                "connection_strength": strength,
                "shared_entities": unique_entities
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# GLOBAL CRIMINAL NETWORK (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/global-network")
def get_global_network(investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "AND n.investigation_id = $inv_id" if investigation_id else ""
            params = {"valid_labels": VALID_LABELS}
            if investigation_id:
                params["inv_id"] = investigation_id

            node_result = session.run(
                f"""
                MATCH (n)
                WHERE size(labels(n)) > 0 AND labels(n)[0] IN $valid_labels {inv_filter}
                RETURN
                    elementId(n) AS element_id,
                    n.id AS id,
                    n.name AS name,
                    n.number AS number,
                    n.type AS type_prop,
                    n.age AS age,
                    n.date AS date,
                    n.latitude AS latitude,
                    n.longitude AS longitude,
                    n.investigation_id AS investigation_id,
                    labels(n) AS labels
                """,
                **params
            )

            nodes = []
            for record in node_result:
                node_id = record["id"] or record["number"] or record["name"] or record["element_id"]
                labels = record["labels"]
                node_type = labels[0] if labels else "Unknown"

                label = (
                    record["name"]
                    or record["number"]
                    or record["type_prop"]
                    or node_id
                )

                props = {"id": str(node_id), "type": node_type}
                if record["age"] is not None:
                    props["age"] = record["age"]
                if record["type_prop"] is not None:
                    props["category"] = record["type_prop"]
                if record["date"] is not None:
                    props["date"] = record["date"]
                if record["latitude"] is not None:
                    props["latitude"] = record["latitude"]
                    props["longitude"] = record["longitude"]
                if record["investigation_id"] is not None:
                    props["investigation_id"] = record["investigation_id"]

                nodes.append({
                    "id": str(node_id),
                    "label": str(label),
                    "type": str(node_type),
                    "properties": props
                })

            rel_inv_filter = "AND a.investigation_id = $inv_id AND b.investigation_id = $inv_id" if investigation_id else ""
            relationship_result = session.run(
                f"""
                MATCH (a)-[r]->(b)
                WHERE size(labels(a)) > 0 AND size(labels(b)) > 0
                  AND labels(a)[0] IN $valid_labels AND labels(b)[0] IN $valid_labels {rel_inv_filter}
                RETURN
                    coalesce(a.id, a.number, a.name) AS source_id,
                    coalesce(b.id, b.number, b.name) AS target_id,
                    type(r) AS relationship
                """,
                **params
            )

            relationships = []
            for record in relationship_result:
                source = record["source_id"]
                target = record["target_id"]

                if source is None or target is None:
                    continue

                relationships.append({
                    "source": str(source),
                    "target": str(target),
                    "type": str(record["relationship"])
                })

            unique_nodes = {node["id"]: node for node in nodes}
            unique_relationships = []
            seen = set()
            for rel in relationships:
                key = (rel["source"], rel["target"], rel["type"])
                if key not in seen:
                    seen.add(key)
                    unique_relationships.append(rel)

            return {
                "nodes": list(unique_nodes.values()),
                "relationships": unique_relationships
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# ALL CASES (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/cases")
def get_cases(investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "WHERE c.investigation_id = $inv_id" if investigation_id else ""
            params = {"inv_id": investigation_id} if investigation_id else {}

            result = session.run(
                f"""
                MATCH (c:Case) {inv_filter}
                OPTIONAL MATCH (c)-[]-(p:Person)
                OPTIONAL MATCH (c)-[:OCCURRED_AT]->(l:Location)
                WITH c, l,
                     collect(
                         DISTINCT {{
                             id: p.id,
                             name: p.name
                         }}
                     ) AS people
                RETURN
                    c.id AS id,
                    c.type AS case_type,
                    c.name AS case_name,
                    c.date AS date,
                    c.status AS status,
                    c.investigation_id AS investigation_id,
                    l.name AS location_name,
                    l.latitude AS latitude,
                    l.longitude AS longitude,
                    people
                ORDER BY c.id
                """,
                **params
            )

            cases = []
            for record in result:
                people = [
                    person for person in record["people"]
                    if person["id"] is not None
                ]

                case_id = record["id"] or "UNKNOWN"
                case_title = record["case_name"] or record["case_type"] or f"Case {case_id}"

                cases.append({
                    "id": str(case_id),
                    "name": case_title,
                    "type": record["case_type"] or "General Crime",
                    "status": record["status"] or "Active Under Investigation",
                    "date": record["date"],
                    "location": record["location_name"] or "Unknown",
                    "latitude": record["latitude"],
                    "longitude": record["longitude"],
                    "investigation_id": record["investigation_id"],
                    "persons": people,
                    "person_count": len(people)
                })

            return {
                "count": len(cases),
                "cases": cases
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# KEY SUSPECTS & CENTRALITY ANALYTICS (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/analytics/key-suspects")
def get_key_suspects(investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "WHERE p.investigation_id = $inv_id" if investigation_id else ""
            params = {"inv_id": investigation_id} if investigation_id else {}

            query = f"""
            MATCH (p:Person) {inv_filter}
            OPTIONAL MATCH (p)-[r]-(connected)
            WHERE size(labels(connected)) > 0 {('AND connected.investigation_id = p.investigation_id' if investigation_id else '')}
            WITH p, count(r) AS degree,
                 collect(DISTINCT labels(connected)[0]) AS types,
                 collect(DISTINCT connected) AS entities
            RETURN
                p.id AS id,
                p.name AS name,
                p.age AS age,
                p.investigation_id AS investigation_id,
                degree,
                size([x IN entities WHERE 'Case' IN labels(x)]) AS cases_count,
                size([x IN entities WHERE 'Phone' IN labels(x)]) AS phones_count,
                size([x IN entities WHERE 'Vehicle' IN labels(x)]) AS vehicles_count,
                size([x IN entities WHERE 'Location' IN labels(x)]) AS locations_count
            ORDER BY degree DESC, cases_count DESC
            """
            result = session.run(query, **params)
            suspects = []
            max_degree = 1

            records = list(result)
            for record in records:
                if record["degree"] > max_degree:
                    max_degree = record["degree"]

            for record in records:
                degree = record["degree"]
                cases = record["cases_count"]
                phones = record["phones_count"]
                vehicles = record["vehicles_count"]

                centrality_score = round(degree / max(max_degree, 1), 2)
                risk_score = min(100, (degree * 14) + (cases * 15) + (phones * 6) + (vehicles * 6))

                suspects.append({
                    "id": record["id"],
                    "name": record["name"],
                    "age": record["age"],
                    "investigation_id": record["investigation_id"],
                    "degree": degree,
                    "centrality_score": centrality_score,
                    "cases_count": cases,
                    "phones_count": phones,
                    "vehicles_count": vehicles,
                    "risk_score": risk_score,
                    "role": "Syndicate Hub" if centrality_score >= 0.8 else ("Key Associate" if centrality_score >= 0.5 else "Operative")
                })

            return {
                "count": len(suspects),
                "suspects": suspects
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# SHORTEST PATH TRACER (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/path/{source_id}/{target_id}")
def get_path(source_id: str, target_id: str, investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "AND a.investigation_id = $inv_id AND b.investigation_id = $inv_id" if investigation_id else ""
            params = {"source_id": source_id, "target_id": target_id}
            if investigation_id:
                params["inv_id"] = investigation_id

            query = f"""
            MATCH (a), (b)
            WHERE (a.id = $source_id OR a.number = $source_id OR a.name = $source_id)
              AND (b.id = $target_id OR b.number = $target_id OR b.name = $target_id)
              AND size(labels(a)) > 0 AND size(labels(b)) > 0 {inv_filter}
            MATCH p = shortestPath((a)-[*]-(b))
            RETURN
                [n IN nodes(p) | {{
                    id: coalesce(n.id, n.number, n.name),
                    label: coalesce(n.name, n.number, n.type, n.id),
                    type: labels(n)[0]
                }}] AS nodes,
                [r IN relationships(p) | {{
                    source: coalesce(startNode(r).id, startNode(r).number, startNode(r).name),
                    target: coalesce(endNode(r).id, endNode(r).number, endNode(r).name),
                    type: type(r)
                }}] AS relationships,
                length(p) AS path_length
            """
            result = session.run(query, **params)
            record = result.single()

            if not record or not record["nodes"]:
                return {
                    "found": False,
                    "source": source_id,
                    "target": target_id,
                    "message": "No connection path found between the selected entities."
                }

            return {
                "found": True,
                "source": source_id,
                "target": target_id,
                "path_length": record["path_length"],
                "nodes": record["nodes"],
                "relationships": record["relationships"]
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --------------------------------------------------
# GLOBAL MULTI-ENTITY SEARCH (INVESTIGATION-SCOPED)
# --------------------------------------------------

@app.get("/search")
def search_entities(q: str = Query(..., min_length=1), investigation_id: Optional[str] = Query(None)):
    try:
        with driver.session(database="neo4j") as session:
            inv_filter = "AND n.investigation_id = $inv_id" if investigation_id else ""
            params = {"q": q, "valid_labels": VALID_LABELS}
            if investigation_id:
                params["inv_id"] = investigation_id

            query = f"""
            MATCH (n)
            WHERE size(labels(n)) > 0 AND labels(n)[0] IN $valid_labels {inv_filter}
              AND (
                  toLower(coalesce(n.id, '')) CONTAINS toLower($q)
                  OR toLower(coalesce(n.name, '')) CONTAINS toLower($q)
                  OR toLower(coalesce(n.number, '')) CONTAINS toLower($q)
                  OR toLower(coalesce(n.type, '')) CONTAINS toLower($q)
              )
            RETURN
                coalesce(n.id, n.number, n.name) AS id,
                coalesce(n.name, n.number, n.type, n.id) AS label,
                labels(n)[0] AS type,
                properties(n) AS properties
            LIMIT 20
            """
            result = session.run(query, **params)
            items = []
            for record in result:
                items.append({
                    "id": str(record["id"]),
                    "label": str(record["label"]),
                    "type": str(record["type"]),
                    "properties": dict(record["properties"])
                })

            return {
                "query": q,
                "count": len(items),
                "results": items
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}
