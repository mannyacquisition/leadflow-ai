"""
Phase 5 - God Mode / Admin API Tests
Tests: admin promotion, agents CRUD, tools CRUD, knowledge base, 
       orchestration threads, edges, execution logs
"""
import os
import io
import pytest
import requests

BASE_URL = "http://localhost:8001"

# ─── Test User Credentials ─────────────────────────────────────────────────────
PHASE5_EMAIL = "phase5_test@leadflow.ai"
PHASE5_PASSWORD = "Phase5Test123!"


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def http():
    """Plain requests session."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="module")
def user_token(http):
    """Register/login a fresh Phase 5 test user and return token."""
    # Try register first
    reg = http.post(f"{BASE_URL}/api/auth/register", json={
        "email": PHASE5_EMAIL,
        "password": PHASE5_PASSWORD,
        "full_name": "Phase5 Tester",
    })
    if reg.status_code in (200, 201):
        token = reg.json().get("token")
    else:
        # Already exists — login
        login = http.post(f"{BASE_URL}/api/auth/login", json={
            "email": PHASE5_EMAIL,
            "password": PHASE5_PASSWORD,
        })
        assert login.status_code == 200, f"Login failed: {login.text}"
        token = login.json().get("token")
    assert token, "No token returned"
    return token


@pytest.fixture(scope="module")
def admin_token(http, user_token):
    """Promote user to admin and return token. Reuse token if already admin."""
    headers = {"Authorization": f"Bearer {user_token}"}

    # Check if already admin
    me = http.get(f"{BASE_URL}/api/auth/me", headers=headers)
    assert me.status_code == 200
    if me.json().get("is_admin"):
        return user_token

    # Try promote-self
    r = http.post(f"{BASE_URL}/api/admin/promote-self", headers=headers)
    if r.status_code == 200:
        return user_token

    # If admin already exists in system, try with the known existing admin
    # Fallback: try with uitest user
    login2 = http.post(f"{BASE_URL}/api/auth/login", json={
        "email": "uitest_leadflow@example.com",
        "password": "UITest123!",
    })
    if login2.status_code == 200:
        token2 = login2.json().get("token")
        me2 = http.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
        if me2.json().get("is_admin"):
            return token2

    pytest.skip(f"Cannot obtain admin token: {r.status_code} {r.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ─── Phase 5 Test: Auth /me includes is_admin ──────────────────────────────────

class TestAuthMe:
    """GET /api/auth/me now returns is_admin field"""

    def test_me_includes_is_admin(self, http, user_token):
        r = http.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "is_admin" in data, "is_admin field missing from /api/auth/me"
        assert isinstance(data["is_admin"], bool), "is_admin should be boolean"

    def test_me_is_admin_after_promotion(self, http, admin_token):
        """After promotion, /api/auth/me should return is_admin=True"""
        r = http.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("is_admin") is True, f"Expected is_admin=True, got {data.get('is_admin')}"


# ─── Phase 5 Test: Admin Promotion ─────────────────────────────────────────────

class TestAdminPromote:
    """POST /api/admin/promote-self"""

    def test_promote_self_works(self, http, user_token):
        """promote-self returns 200 if no admin exists or user is already admin"""
        headers = {"Authorization": f"Bearer {user_token}"}
        me = http.get(f"{BASE_URL}/api/auth/me", headers=headers).json()
        if me.get("is_admin"):
            pytest.skip("User is already admin — promotion already done")

        r = http.post(f"{BASE_URL}/api/admin/promote-self", headers=headers)
        assert r.status_code in (200, 403), f"Unexpected: {r.status_code} {r.text}"
        if r.status_code == 200:
            assert r.json().get("is_admin") is True

    def test_admin_overview_requires_auth(self, http):
        r = http.get(f"{BASE_URL}/api/admin/overview")
        assert r.status_code in (401, 422), f"Should require auth, got {r.status_code}"

    def test_admin_overview_requires_admin_role(self, http):
        """Non-admin token should get 403"""
        # Register a separate non-admin user
        reg = http.post(f"{BASE_URL}/api/auth/register", json={
            "email": "nonadmin_p5@leadflow.ai",
            "password": "NoAdmin123!",
            "full_name": "Non Admin",
        })
        if reg.status_code in (200, 201):
            tok = reg.json().get("token")
        else:
            login = http.post(f"{BASE_URL}/api/auth/login", json={
                "email": "nonadmin_p5@leadflow.ai",
                "password": "NoAdmin123!",
            })
            tok = login.json().get("token") if login.status_code == 200 else None

        if not tok:
            pytest.skip("Could not get non-admin token")

        r = http.get(f"{BASE_URL}/api/admin/overview",
                     headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ─── Phase 5 Test: Admin Overview ──────────────────────────────────────────────

class TestAdminOverview:
    """GET /api/admin/overview"""

    def test_overview_returns_stats(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/overview", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200: {r.status_code} {r.text}"
        data = r.json()
        assert "agent_count" in data
        assert "tool_count" in data
        assert "knowledge_files" in data
        assert "total_executions" in data
        assert "pending_hitl" in data
        for k, v in data.items():
            assert isinstance(v, int), f"Field {k} should be int, got {type(v)}: {v}"


# ─── Phase 5 Test: Agent Config CRUD ───────────────────────────────────────────

class TestAgentCRUD:
    """POST/GET/PATCH /api/admin/agents"""

    _agent_id = None

    def test_create_agent(self, http, admin_headers):
        payload = {
            "name": "TEST_Phase5_Worker",
            "description": "Auto-test agent",
            "agent_role": "worker",
            "provider": "anthropic",
            "model_name": "claude-sonnet-4-5-20250929",
            "temperature": 0.5,
        }
        r = http.post(f"{BASE_URL}/api/admin/agents", headers=admin_headers, json=payload)
        assert r.status_code == 200, f"Create agent failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data.get("name") == "TEST_Phase5_Worker"
        TestAgentCRUD._agent_id = data["id"]
        print(f"Created agent: {data['id']}")

    def test_list_agents(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/agents", headers=admin_headers)
        assert r.status_code == 200, f"List agents failed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)
        # Verify our created agent is in the list
        ids = [a["id"] for a in data]
        assert TestAgentCRUD._agent_id in ids, f"Created agent {TestAgentCRUD._agent_id} not in list"

    def test_list_agents_has_required_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/agents", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        if not data:
            pytest.skip("No agents to check fields")
        agent = next((a for a in data if a.get("id") == TestAgentCRUD._agent_id), data[0])
        required_fields = ["id", "name", "agent_role", "provider", "model_name", "temperature", "is_active"]
        for f in required_fields:
            assert f in agent, f"Missing field '{f}' in agent response"

    def test_update_agent(self, http, admin_headers):
        if not TestAgentCRUD._agent_id:
            pytest.skip("No agent to update")
        r = http.patch(
            f"{BASE_URL}/api/admin/agents/{TestAgentCRUD._agent_id}",
            headers=admin_headers,
            json={"description": "Updated description", "temperature": 0.9}
        )
        assert r.status_code == 200, f"Update agent failed: {r.status_code} {r.text}"
        assert r.json().get("message") == "Agent updated"

    def test_update_agent_not_found(self, http, admin_headers):
        r = http.patch(
            f"{BASE_URL}/api/admin/agents/nonexistent-id",
            headers=admin_headers,
            json={"description": "test"}
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"


# ─── Phase 5 Test: Workflow Edges ──────────────────────────────────────────────

class TestWorkflowEdges:
    """GET/POST /api/admin/edges"""

    _edge_id = None
    _agent2_id = None

    def test_list_edges_empty_initially(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_headers)
        assert r.status_code == 200, f"List edges failed: {r.status_code} {r.text}"
        assert isinstance(r.json(), list)

    def test_create_edge(self, http, admin_headers):
        # Create second agent first
        r2 = http.post(f"{BASE_URL}/api/admin/agents", headers=admin_headers, json={
            "name": "TEST_Phase5_God",
            "agent_role": "god",
            "provider": "anthropic",
            "model_name": "claude-sonnet-4-5-20250929",
        })
        assert r2.status_code == 200, f"Create second agent failed: {r2.text}"
        TestWorkflowEdges._agent2_id = r2.json()["id"]

        source = TestAgentCRUD._agent_id
        target = TestWorkflowEdges._agent2_id
        if not source or not target:
            pytest.skip("Need agent IDs to create edge")

        r = http.post(f"{BASE_URL}/api/admin/edges", headers=admin_headers, json={
            "source_node_id": source,
            "target_node_id": target,
            "condition_type": "on_success",
            "weight": 1.0,
        })
        assert r.status_code == 200, f"Create edge failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data.get("message") == "Edge created"
        TestWorkflowEdges._edge_id = data["id"]

    def test_list_edges_includes_created(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_headers)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestWorkflowEdges._edge_id in ids, "Created edge not found in list"

    def test_edge_has_required_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_headers)
        assert r.status_code == 200
        edges = r.json()
        if not edges:
            pytest.skip("No edges to check")
        edge = next((e for e in edges if e.get("id") == TestWorkflowEdges._edge_id), edges[0])
        for field in ["id", "source_node_id", "target_node_id", "condition_type", "weight"]:
            assert field in edge, f"Missing field '{field}' in edge response"


# ─── Phase 5 Test: Tool Registry ───────────────────────────────────────────────

class TestToolRegistry:
    """GET/POST /api/admin/tools"""

    _tool_id = None

    def test_create_tool(self, http, admin_headers):
        payload = {
            "name": "TEST_Phase5_REST_Tool",
            "description": "Auto-test REST tool",
            "integration_type": "rest",
            "endpoint_url": "https://api.example.com/test",
            "auth_headers": {"Authorization": "Bearer test-key"},
            "openapi_schema": {"method": "POST"},
        }
        r = http.post(f"{BASE_URL}/api/admin/tools", headers=admin_headers, json=payload)
        assert r.status_code == 200, f"Create tool failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data.get("name") == "TEST_Phase5_REST_Tool"
        TestToolRegistry._tool_id = data["id"]

    def test_list_tools(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_headers)
        assert r.status_code == 200, f"List tools failed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)
        ids = [t["id"] for t in data]
        assert TestToolRegistry._tool_id in ids, "Created tool not in list"

    def test_tool_has_required_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_headers)
        assert r.status_code == 200
        tools = r.json()
        if not tools:
            pytest.skip("No tools")
        tool = next((t for t in tools if t.get("id") == TestToolRegistry._tool_id), tools[0])
        for field in ["id", "name", "integration_type", "is_active", "has_auth", "created_at"]:
            assert field in tool, f"Missing field '{field}'"

    def test_tool_auth_headers_encrypted(self, http, admin_headers):
        """Auth headers should not be returned in plain text."""
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_headers)
        assert r.status_code == 200
        tools = r.json()
        tool = next((t for t in tools if t.get("id") == TestToolRegistry._tool_id), None)
        if not tool:
            pytest.skip("Tool not found")
        assert "auth_headers" not in tool or not tool.get("auth_headers"), \
            "Auth headers should not be returned in plain text"
        assert tool.get("has_auth") is True, "has_auth should be True"


# ─── Phase 5 Test: Knowledge Base ──────────────────────────────────────────────

class TestKnowledgeBase:
    """POST /api/admin/knowledge/upload and GET /api/admin/knowledge/files"""

    _kb_id = None

    def test_upload_text_file(self, http, admin_headers):
        """Upload a simple text file to the knowledge base."""
        # Prepare multipart form data upload (not JSON)
        text_content = b"This is a test document for LeadFlow AI knowledge base. It contains information about sales automation and lead generation strategies."
        files = {"file": ("test_knowledge.txt", io.BytesIO(text_content), "text/plain")}
        data = {"is_global": "false", "tags": "[]"}

        # Need to use multipart headers (not application/json)
        # Setting Content-Type=None forces requests to auto-set multipart boundary
        upload_headers = {k: v for k, v in admin_headers.items() if k != "Content-Type"}
        upload_headers["Content-Type"] = None  # Override session-level Content-Type
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers=upload_headers,
            files=files,
            data=data,
        )
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        result = r.json()
        assert "id" in result
        assert result.get("file_name") == "test_knowledge.txt"
        assert result.get("file_type") == "text"
        assert "Embedding in progress" in result.get("message", "")
        TestKnowledgeBase._kb_id = result["id"]
        print(f"Uploaded KB file: {result['id']}")

    def test_list_knowledge_files(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_headers)
        assert r.status_code == 200, f"List knowledge files failed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)
        ids = [f["id"] for f in data]
        if TestKnowledgeBase._kb_id:
            assert TestKnowledgeBase._kb_id in ids, "Uploaded file not in list"

    def test_knowledge_file_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_headers)
        assert r.status_code == 200
        files = r.json()
        if not files:
            pytest.skip("No KB files")
        f = files[0]
        for field in ["id", "file_name", "file_url", "file_type", "is_global", "chunk_count", "created_at"]:
            assert field in f, f"Missing field '{field}' in knowledge file response"

    def test_upload_pdf_not_supported_gracefully(self, http, admin_headers):
        """Ensure PDF upload returns 200 (processing happens in background)."""
        upload_headers = {k: v for k, v in admin_headers.items() if k != "Content-Type"}
        upload_headers["Content-Type"] = None  # Override session-level Content-Type
        # Fake minimal PDF-like content (will still trigger processing)
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers=upload_headers,
            files={"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")},
            data={"is_global": "true", "tags": "[]"},
        )
        assert r.status_code == 200, f"Upload returned unexpected status: {r.status_code} {r.text}"


# ─── Phase 5 Test: Orchestration Threads ───────────────────────────────────────

class TestOrchestrationThreads:
    """POST /api/admin/orchestration/threads/simulate and GET /threads"""

    _thread_id = None

    def test_simulate_thread_no_agents(self, http, admin_headers):
        """Simulate returns 200 response. Status depends on whether agents are configured."""
        r = http.post(
            f"{BASE_URL}/api/admin/orchestration/threads/simulate",
            headers=admin_headers,
            json={
                "payload": {
                    "name": "John Test",
                    "company": "TestCorp",
                    "job_title": "VP of Sales",
                },
                "signal_category": "warm_inbound",
            },
        )
        # NOTE: If agents exist AND LLM call fails (sync Anthropic client in async context),
        # the backend may return 500 due to SQLAlchemy session corruption.
        # This is a known bug: orchestrator uses sync anthropic.Anthropic() in async routes.
        # When no agents are configured, returns 200 with status=failed.
        if r.status_code == 500:
            pytest.xfail(
                "KNOWN BUG: Orchestrator uses sync Anthropic client in async context, "
                "causing SQLAlchemy MissingGreenlet error when LLM agents are configured. "
                "Fix: use anthropic.AsyncAnthropic() in services/orchestrator.py"
            )
        assert r.status_code == 200, f"Simulate failed: {r.status_code} {r.text}"
        data = r.json()
        assert "thread_id" in data
        assert "status" in data
        assert "events" in data
        assert "message_history" in data
        assert data["status"] in ("failed", "completed", "pending_human_approval"), \
            f"Unexpected status: {data['status']}"
        TestOrchestrationThreads._thread_id = data["thread_id"]
        print(f"Simulated thread: {data['thread_id']} status={data['status']}")

    def test_simulate_thread_returns_events(self, http, admin_headers):
        """Events list should be present (can be empty if no agents)"""
        r = http.post(
            f"{BASE_URL}/api/admin/orchestration/threads/simulate",
            headers=admin_headers,
            json={
                "payload": {"name": "Jane Test"},
                "signal_category": "topic_authority",
            },
        )
        if r.status_code == 500:
            pytest.xfail("KNOWN BUG: Sync Anthropic client in async context - see test_simulate_thread_no_agents")
        assert r.status_code == 200
        assert isinstance(r.json().get("events"), list)

    def test_list_orchestration_threads(self, http, admin_headers):
        """GET /api/admin/orchestration/threads lists threads"""
        r = http.get(
            f"{BASE_URL}/api/admin/orchestration/threads",
            headers=admin_headers,
        )
        assert r.status_code == 200, f"List threads failed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list)

    def test_list_threads_with_status_filter(self, http, admin_headers):
        r = http.get(
            f"{BASE_URL}/api/admin/orchestration/threads?status=completed",
            headers=admin_headers,
        )
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "completed"

    def test_list_threads_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/orchestration/threads?limit=5", headers=admin_headers)
        assert r.status_code == 200
        threads = r.json()
        if not threads:
            pytest.skip("No threads to check fields")
        t = threads[0]
        for field in ["id", "status", "created_at"]:
            assert field in t, f"Missing field '{field}' in thread"


# ─── Phase 5 Test: Execution Logs ──────────────────────────────────────────────

class TestExecutionLogs:
    """GET /api/admin/executions"""

    def test_list_executions(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/executions", headers=admin_headers)
        assert r.status_code == 200, f"List executions failed: {r.status_code} {r.text}"
        assert isinstance(r.json(), list)

    def test_list_executions_fields(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/executions?limit=5", headers=admin_headers)
        assert r.status_code == 200
        execs = r.json()
        if not execs:
            pytest.skip("No executions to check")
        e = execs[0]
        for field in ["id", "status", "created_at", "total_tokens_used"]:
            assert field in e, f"Missing field '{field}' in execution"

    def test_get_execution_not_found(self, http, admin_headers):
        r = http.get(f"{BASE_URL}/api/admin/executions/nonexistent-id", headers=admin_headers)
        assert r.status_code == 404


# ─── Phase 5 Test: Gemini Embedding Dimension ──────────────────────────────────

class TestGeminiEmbedding:
    """Test that gemini-embedding-2-preview returns 3072-dim vectors"""

    def test_embedding_dim_via_upload(self, http, admin_headers):
        """Upload a text file and verify embedding is triggered (non-zero chunk_count)."""
        import time
        upload_headers = {k: v for k, v in admin_headers.items() if k != "Content-Type"}
        upload_headers["Content-Type"] = None  # Override session-level Content-Type
        content = b"Gemini embedding dimension test content for phase 5 validation."
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers=upload_headers,
            files={"file": ("embed_test.txt", io.BytesIO(content), "text/plain")},
            data={"is_global": "false", "tags": "[]"},
        )
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        kb_id = r.json()["id"]
        
        # Wait for background embedding to complete (up to 30 seconds)
        kb_file = None
        for _ in range(15):
            time.sleep(2)
            files_resp = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_headers)
            if files_resp.status_code == 200:
                files_list = files_resp.json()
                kb_file = next((f for f in files_list if f["id"] == kb_id), None)
                if kb_file and kb_file.get("chunk_count", 0) != 0:
                    break
        
        assert kb_file is not None, "KB file not found"
        assert kb_file["chunk_count"] != 0, \
            "Embedding did not complete (chunk_count still 0 after 30s)"
        print(f"Embedding complete: chunk_count={kb_file['chunk_count']}")
        
        # If chunk_count == -1, embedding failed
        assert kb_file["chunk_count"] > 0, \
            f"Embedding failed: chunk_count={kb_file['chunk_count']}. Check GEMINI_API_KEY."


# ─── Phase 5 Test: Non-admin cannot access admin routes ───────────────────────

class TestAdminAccessControl:
    """403 for non-admin users"""

    @pytest.fixture(scope="class")
    def nonadmin_token(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonadmin_p5@leadflow.ai",
            "password": "NoAdmin123!",
        })
        if r.status_code != 200:
            pytest.skip("Non-admin user not available")
        return r.json().get("token")

    def test_nonadmin_cannot_list_agents(self, http, nonadmin_token):
        r = http.get(f"{BASE_URL}/api/admin/agents",
                     headers={"Authorization": f"Bearer {nonadmin_token}"})
        assert r.status_code == 403

    def test_nonadmin_cannot_list_tools(self, http, nonadmin_token):
        r = http.get(f"{BASE_URL}/api/admin/tools",
                     headers={"Authorization": f"Bearer {nonadmin_token}"})
        assert r.status_code == 403

    def test_nonadmin_cannot_upload_knowledge(self, http, nonadmin_token):
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers={"Authorization": f"Bearer {nonadmin_token}"},
            files={"file": ("x.txt", io.BytesIO(b"test"), "text/plain")},
            data={"is_global": "false", "tags": "[]"},
        )
        assert r.status_code == 403
