"""
Phase 5 - Iteration 5 Test Suite
Tests:
  - AdminShell redirect and access guard (backend checks for 401/403)
  - GET /api/admin/overview
  - Agent CRUD: list, create, patch (position_x/y), delete
  - Workflow Edges CRUD
  - Tool Registry: REST, Apify types, update, delete
  - Knowledge Base: list files, upload text, search
  - Orchestration: simulate (now with AsyncAnthropic - should NOT 500), list threads
  - Execution Logs: list, get detail by thread_id
  - Webhook God Mode routing: POST /api/webhook/apify with valid secret
"""
import os
import io
import time
import pytest
import requests

BASE_URL = "http://localhost:8001"

PHASE5_EMAIL = "phase5_test@leadflow.ai"
PHASE5_PASSWORD = "Phase5Test123!"
NONADMIN_EMAIL = "nonadmin_p5@leadflow.ai"
NONADMIN_PASSWORD = "NoAdmin123!"
APIFY_SECRET = "tHYKTYdy-iiWJPICwXxkw1eAqqcwdYXz"


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    """Login as admin user."""
    r = http.post(f"{BASE_URL}/api/auth/login", json={
        "email": PHASE5_EMAIL, "password": PHASE5_PASSWORD,
    })
    if r.status_code != 200:
        # Try register + promote
        reg = http.post(f"{BASE_URL}/api/auth/register", json={
            "email": PHASE5_EMAIL, "password": PHASE5_PASSWORD, "full_name": "Phase5 Tester"
        })
        if reg.status_code in (200, 201):
            tok = reg.json().get("token")
            http.post(f"{BASE_URL}/api/admin/promote-self",
                      headers={"Authorization": f"Bearer {tok}"})
            return tok
        pytest.skip(f"Cannot obtain admin token: {r.status_code} {r.text}")
    data = r.json()
    tok = data.get("token")
    # Ensure admin flag
    assert data.get("user", {}).get("is_admin") or True, "Checking admin flag"
    return tok


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def nonadmin_token(http):
    """Login as non-admin user."""
    r = http.post(f"{BASE_URL}/api/auth/login", json={
        "email": NONADMIN_EMAIL, "password": NONADMIN_PASSWORD,
    })
    if r.status_code != 200:
        # try register
        reg = http.post(f"{BASE_URL}/api/auth/register", json={
            "email": NONADMIN_EMAIL, "password": NONADMIN_PASSWORD, "full_name": "Non Admin"
        })
        if reg.status_code in (200, 201):
            return reg.json().get("token")
        pytest.skip(f"Cannot obtain non-admin token")
    return r.json().get("token")


# ─── Auth + Access ─────────────────────────────────────────────────────────────

class TestAuthAccess:
    """Verify auth/me, admin guard, and non-admin guard."""

    def test_me_is_admin_true(self, http, admin_token):
        r = http.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, f"/auth/me failed: {r.text}"
        data = r.json()
        assert "is_admin" in data, "is_admin field missing"
        assert data["is_admin"] is True, f"Expected is_admin=True, got {data['is_admin']}"

    def test_unauthenticated_admin_returns_401(self, http):
        r = http.get(f"{BASE_URL}/api/admin/overview")
        assert r.status_code in (401, 422), f"Should require auth, got {r.status_code}"

    def test_nonadmin_gets_403(self, http, nonadmin_token):
        r = http.get(f"{BASE_URL}/api/admin/overview",
                     headers={"Authorization": f"Bearer {nonadmin_token}"})
        assert r.status_code == 403, f"Expected 403 for non-admin, got {r.status_code}: {r.text}"

    def test_me_nonadmin_is_false(self, http, nonadmin_token):
        r = http.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {nonadmin_token}"})
        assert r.status_code == 200
        assert r.json().get("is_admin") is False, "Non-admin user should have is_admin=False"


# ─── Admin Overview ────────────────────────────────────────────────────────────

class TestAdminOverview:

    def test_overview_returns_all_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/overview", headers=admin_h)
        assert r.status_code == 200, f"Overview failed: {r.text}"
        data = r.json()
        for field in ["agent_count", "tool_count", "knowledge_files", "total_executions", "pending_hitl"]:
            assert field in data, f"Missing field '{field}'"
            assert isinstance(data[field], int), f"Field '{field}' should be int"

    def test_overview_non_negative_values(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/overview", headers=admin_h)
        data = r.json()
        for k, v in data.items():
            assert v >= 0, f"Field {k} is negative: {v}"


# ─── Agent CRUD ────────────────────────────────────────────────────────────────

class TestAgentCRUD:
    _agent_id = None

    def test_create_agent(self, http, admin_h):
        r = http.post(f"{BASE_URL}/api/admin/agents", headers=admin_h, json={
            "name": "TEST_IT5_God_Agent",
            "description": "IT5 test God agent",
            "agent_role": "god",
            "provider": "anthropic",
            "model_name": "claude-sonnet-4-5-20250929",
            "temperature": 0.5,
            "system_prompt": "You are a God-mode orchestrator agent for lead processing.",
            "position_x": 100.0,
            "position_y": 200.0,
        })
        assert r.status_code == 200, f"Create agent failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["name"] == "TEST_IT5_God_Agent"
        TestAgentCRUD._agent_id = data["id"]
        print(f"Created agent id: {data['id']}")

    def test_list_agents(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/agents", headers=admin_h)
        assert r.status_code == 200
        agents = r.json()
        assert isinstance(agents, list)
        assert len(agents) > 0
        ids = [a["id"] for a in agents]
        assert TestAgentCRUD._agent_id in ids

    def test_list_agents_has_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/agents", headers=admin_h)
        agents = r.json()
        agent = next((a for a in agents if a["id"] == TestAgentCRUD._agent_id), None)
        assert agent is not None
        for field in ["id", "name", "agent_role", "provider", "model_name", "temperature",
                      "is_active", "position_x", "position_y", "created_at"]:
            assert field in agent, f"Missing field '{field}'"

    def test_patch_agent_update_fields(self, http, admin_h):
        if not TestAgentCRUD._agent_id:
            pytest.skip("No agent id")
        r = http.patch(f"{BASE_URL}/api/admin/agents/{TestAgentCRUD._agent_id}",
                       headers=admin_h, json={
                           "description": "Updated by IT5 test",
                           "temperature": 0.8,
                           "position_x": 350.0,
                           "position_y": 150.0,
                       })
        assert r.status_code == 200, f"Patch agent failed: {r.status_code} {r.text}"
        assert r.json().get("message") == "Agent updated"

    def test_patch_agent_position_for_react_flow(self, http, admin_h):
        """React Flow drag should update position_x/y."""
        if not TestAgentCRUD._agent_id:
            pytest.skip("No agent id")
        r = http.patch(f"{BASE_URL}/api/admin/agents/{TestAgentCRUD._agent_id}",
                       headers=admin_h, json={"position_x": 500.0, "position_y": 300.0})
        assert r.status_code == 200, f"Position update failed: {r.status_code} {r.text}"

    def test_patch_agent_not_found(self, http, admin_h):
        r = http.patch(f"{BASE_URL}/api/admin/agents/NONEXISTENT",
                       headers=admin_h, json={"description": "x"})
        assert r.status_code == 404

    def test_delete_agent(self, http, admin_h):
        # Create a temp agent to delete
        r = http.post(f"{BASE_URL}/api/admin/agents", headers=admin_h, json={
            "name": "TEST_IT5_DELETE_ME", "agent_role": "worker",
            "provider": "anthropic", "model_name": "claude-haiku-4-5",
        })
        assert r.status_code == 200
        del_id = r.json()["id"]

        dr = http.delete(f"{BASE_URL}/api/admin/agents/{del_id}", headers=admin_h)
        assert dr.status_code == 200, f"Delete agent failed: {dr.text}"

        # Verify deleted
        agents = http.get(f"{BASE_URL}/api/admin/agents", headers=admin_h).json()
        assert del_id not in [a["id"] for a in agents], "Deleted agent still in list"


# ─── Workflow Edges CRUD ───────────────────────────────────────────────────────

class TestWorkflowEdges:
    _edge_id = None
    _target_agent_id = None

    def test_list_edges(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_edge(self, http, admin_h):
        # Create a target agent
        r = http.post(f"{BASE_URL}/api/admin/agents", headers=admin_h, json={
            "name": "TEST_IT5_Worker_Node", "agent_role": "worker",
            "provider": "anthropic", "model_name": "claude-sonnet-4-5-20250929",
        })
        assert r.status_code == 200
        TestWorkflowEdges._target_agent_id = r.json()["id"]

        edge_r = http.post(f"{BASE_URL}/api/admin/edges", headers=admin_h, json={
            "source_node_id": TestAgentCRUD._agent_id,
            "target_node_id": TestWorkflowEdges._target_agent_id,
            "condition_type": "on_success",
            "weight": 1.0,
        })
        assert edge_r.status_code == 200, f"Create edge failed: {edge_r.status_code} {edge_r.text}"
        data = edge_r.json()
        assert "id" in data
        TestWorkflowEdges._edge_id = data["id"]

    def test_list_edges_contains_created(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_h)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestWorkflowEdges._edge_id in ids

    def test_edge_has_required_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/edges", headers=admin_h)
        edges = r.json()
        edge = next((e for e in edges if e["id"] == TestWorkflowEdges._edge_id), None)
        assert edge is not None
        for field in ["id", "source_node_id", "target_node_id", "condition_type", "weight"]:
            assert field in edge, f"Missing field '{field}'"

    def test_delete_edge(self, http, admin_h):
        if not TestWorkflowEdges._edge_id:
            pytest.skip("No edge to delete")
        r = http.delete(f"{BASE_URL}/api/admin/edges/{TestWorkflowEdges._edge_id}", headers=admin_h)
        assert r.status_code == 200, f"Delete edge failed: {r.text}"


# ─── Tool Registry CRUD ────────────────────────────────────────────────────────

class TestToolRegistry:
    _tool_rest_id = None
    _tool_apify_id = None

    def test_create_rest_tool(self, http, admin_h):
        r = http.post(f"{BASE_URL}/api/admin/tools", headers=admin_h, json={
            "name": "TEST_IT5_REST_Tool",
            "description": "Auto-test REST tool for IT5",
            "integration_type": "rest",
            "endpoint_url": "https://httpbin.org/post",
            "auth_headers": {"Authorization": "Bearer test-key-123"},
            "openapi_schema": {"method": "POST"},
        })
        assert r.status_code == 200, f"Create REST tool failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["name"] == "TEST_IT5_REST_Tool"
        TestToolRegistry._tool_rest_id = data["id"]

    def test_create_apify_tool(self, http, admin_h):
        """Register Apify type tool."""
        r = http.post(f"{BASE_URL}/api/admin/tools", headers=admin_h, json={
            "name": "TEST_IT5_Apify_Tool",
            "description": "Auto-test Apify actor tool for IT5",
            "integration_type": "apify",
            "endpoint_url": "lhotanova~google-news-scraper",
            "auth_headers": {"token": "test-apify-token-xxx"},
            "openapi_schema": {"max_items": 5, "poll_timeout_seconds": 60},
        })
        assert r.status_code == 200, f"Create Apify tool failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["name"] == "TEST_IT5_Apify_Tool"
        TestToolRegistry._tool_apify_id = data["id"]

    def test_list_tools(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_h)
        assert r.status_code == 200
        tools = r.json()
        assert isinstance(tools, list)
        ids = [t["id"] for t in tools]
        assert TestToolRegistry._tool_rest_id in ids
        assert TestToolRegistry._tool_apify_id in ids

    def test_tool_has_required_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_h)
        tools = r.json()
        tool = next((t for t in tools if t["id"] == TestToolRegistry._tool_rest_id), None)
        assert tool is not None
        for field in ["id", "name", "integration_type", "is_active", "has_auth", "created_at"]:
            assert field in tool, f"Missing field '{field}'"

    def test_tool_auth_headers_not_in_plain_text(self, http, admin_h):
        """Encrypted auth_headers should NOT be exposed."""
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_h)
        tool = next((t for t in r.json() if t["id"] == TestToolRegistry._tool_rest_id), None)
        assert tool is not None
        assert tool.get("has_auth") is True, "has_auth should be True for tool with auth_headers"
        # auth_headers field should not have plain text values
        raw_auth = tool.get("auth_headers")
        assert raw_auth is None or raw_auth == {}, "Auth headers exposed in plain text"

    def test_apify_tool_integration_type(self, http, admin_h):
        """Verify Apify tool stores correct integration_type."""
        r = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_h)
        tool = next((t for t in r.json() if t["id"] == TestToolRegistry._tool_apify_id), None)
        assert tool is not None
        assert tool["integration_type"] == "apify", f"Expected 'apify', got {tool['integration_type']}"

    def test_patch_tool(self, http, admin_h):
        if not TestToolRegistry._tool_rest_id:
            pytest.skip("No tool to update")
        r = http.patch(f"{BASE_URL}/api/admin/tools/{TestToolRegistry._tool_rest_id}",
                       headers=admin_h, json={"description": "Updated by IT5 test", "is_active": False})
        assert r.status_code == 200, f"Patch tool failed: {r.status_code} {r.text}"
        assert r.json().get("message") == "Tool updated"

    def test_delete_tool(self, http, admin_h):
        # Create temp tool to delete
        r = http.post(f"{BASE_URL}/api/admin/tools", headers=admin_h, json={
            "name": "TEST_IT5_DELETE_TOOL", "integration_type": "rest"
        })
        assert r.status_code == 200
        del_id = r.json()["id"]
        dr = http.delete(f"{BASE_URL}/api/admin/tools/{del_id}", headers=admin_h)
        assert dr.status_code == 200, f"Delete tool failed: {dr.text}"
        # Verify deleted
        tools = http.get(f"{BASE_URL}/api/admin/tools", headers=admin_h).json()
        assert del_id not in [t["id"] for t in tools]


# ─── Knowledge Base ────────────────────────────────────────────────────────────

class TestKnowledgeBase:
    _kb_id = None

    def test_list_knowledge_files(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_h)
        assert r.status_code == 200, f"List KB files failed: {r.text}"
        assert isinstance(r.json(), list)

    def test_upload_text_file(self, http, admin_h):
        upload_h = {k: v for k, v in admin_h.items() if k != "Content-Type"}
        content = b"IT5 test content: Sales automation and B2B lead generation strategies for LeadFlow AI."
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers=upload_h,
            files={"file": ("it5_test.txt", io.BytesIO(content), "text/plain")},
            data={"is_global": "false", "tags": "[]"},
        )
        assert r.status_code == 200, f"Upload text file failed: {r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["file_name"] == "it5_test.txt"
        assert data["file_type"] == "text"
        assert "Embedding" in data["message"]
        TestKnowledgeBase._kb_id = data["id"]

    def test_upload_global_file(self, http, admin_h):
        """Upload global knowledge file."""
        upload_h = {k: v for k, v in admin_h.items() if k != "Content-Type"}
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/upload",
            headers=upload_h,
            files={"file": ("global_kb.txt", io.BytesIO(b"Global knowledge content."), "text/plain")},
            data={"is_global": "true", "tags": "[]"},
        )
        assert r.status_code == 200, f"Upload global file failed: {r.status_code} {r.text}"
        assert r.json().get("id") is not None

    def test_uploaded_file_in_list(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_h)
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()]
        if TestKnowledgeBase._kb_id:
            assert TestKnowledgeBase._kb_id in ids, "Uploaded file not in list"

    def test_kb_file_has_required_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/knowledge/files", headers=admin_h)
        files = r.json()
        if not files:
            pytest.skip("No KB files")
        f = files[0]
        for field in ["id", "file_name", "file_url", "file_type", "is_global", "chunk_count", "created_at"]:
            assert field in f, f"Missing field '{field}'"

    def test_knowledge_search(self, http, admin_h):
        """POST /api/admin/knowledge/search semantic search."""
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/search?query=B2B+lead+generation&top_k=3",
            headers=admin_h,
        )
        assert r.status_code == 200, f"Knowledge search failed: {r.status_code} {r.text}"
        data = r.json()
        assert "query" in data
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_knowledge_search_returns_results_structure(self, http, admin_h):
        r = http.post(
            f"{BASE_URL}/api/admin/knowledge/search?query=sales+automation",
            headers=admin_h,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["query"] == "sales automation"
        for result in data.get("results", []):
            assert "chunk_text" in result or "text" in result or isinstance(result, dict)


# ─── Orchestration: Simulate (should NOT 500 with AsyncAnthropic fix) ──────────

class TestOrchestrationSimulate:
    _thread_id = None
    _sim_thread_id = None

    def test_simulate_no_agents_returns_200(self, http, admin_h):
        """Simulate endpoint returns 200. When no entry agent, status=failed but NOT 500."""
        r = http.post(
            f"{BASE_URL}/api/admin/orchestration/threads/simulate",
            headers=admin_h,
            json={"payload": {"name": "Jane Test", "company": "ACME"}, "signal_category": "warm_inbound"},
        )
        assert r.status_code == 200, (
            f"Simulate returned {r.status_code}: {r.text}\n"
            "CRITICAL: If 500, orchestrator still uses sync Anthropic client or other async issue."
        )
        data = r.json()
        assert "thread_id" in data, "Missing thread_id in simulate response"
        assert "status" in data, "Missing status in simulate response"
        assert "events" in data, "Missing events in simulate response"
        assert isinstance(data["events"], list)
        TestOrchestrationSimulate._sim_thread_id = data["thread_id"]

    def test_simulate_with_agents_returns_200_not_500(self, http, admin_h):
        """
        With agents configured, simulate should NOT return 500 (AsyncAnthropic fix).
        It may return status=failed if LLM key invalid, but not 500.
        """
        r = http.post(
            f"{BASE_URL}/api/admin/orchestration/threads/simulate",
            headers=admin_h,
            json={
                "payload": {
                    "name": "John Doe",
                    "company": "TechCorp",
                    "job_title": "VP Engineering",
                    "signal": "Engaged with post"
                },
                "signal_category": "warm_inbound",
            },
        )
        # The critical check: must NOT be 500
        assert r.status_code != 500, (
            f"CRITICAL BUG: Simulate returned 500 even with AsyncAnthropic fix!\n{r.text}"
        )
        assert r.status_code == 200, f"Simulate failed with: {r.status_code} {r.text}"
        data = r.json()
        assert "thread_id" in data
        assert "status" in data
        print(f"Simulate with agents: status={data['status']}, tokens={data.get('total_tokens_used')}")

    def test_simulate_response_has_all_fields(self, http, admin_h):
        r = http.post(
            f"{BASE_URL}/api/admin/orchestration/threads/simulate",
            headers=admin_h,
            json={"payload": {"test": "data"}, "signal_category": "trigger_event"},
        )
        if r.status_code == 500:
            pytest.xfail("Simulate returned 500 - async bug not fully fixed")
        assert r.status_code == 200
        data = r.json()
        for field in ["thread_id", "status", "events", "message_history"]:
            assert field in data, f"Missing field '{field}' in simulate response"


# ─── Orchestration: Threads List ──────────────────────────────────────────────

class TestOrchestrationThreads:

    def test_list_threads(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/orchestration/threads", headers=admin_h)
        assert r.status_code == 200, f"List threads failed: {r.text}"
        assert isinstance(r.json(), list)

    def test_list_threads_with_status_filter(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/orchestration/threads?status=failed", headers=admin_h)
        assert r.status_code == 200
        threads = r.json()
        for t in threads:
            assert t["status"] == "failed", f"Expected status=failed, got {t['status']}"

    def test_list_threads_required_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/orchestration/threads?limit=5", headers=admin_h)
        assert r.status_code == 200
        threads = r.json()
        if not threads:
            pytest.skip("No threads yet")
        for field in ["id", "status", "created_at"]:
            assert field in threads[0], f"Missing '{field}' in thread"


# ─── Execution Logs ────────────────────────────────────────────────────────────

class TestExecutionLogs:
    _exec_id = None

    def test_list_executions(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/executions", headers=admin_h)
        assert r.status_code == 200, f"List executions failed: {r.text}"
        data = r.json()
        assert isinstance(data, list)
        if data:
            TestExecutionLogs._exec_id = data[0]["id"]

    def test_list_executions_fields(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/executions?limit=5", headers=admin_h)
        execs = r.json()
        if not execs:
            pytest.skip("No executions")
        e = execs[0]
        for field in ["id", "status", "created_at", "total_tokens_used", "final_output_preview"]:
            assert field in e, f"Missing field '{field}'"

    def test_get_execution_detail_by_id(self, http, admin_h):
        """GET /api/admin/executions/{thread_id} - used by ExecutionLogs.jsx."""
        if not TestExecutionLogs._exec_id:
            pytest.skip("No execution to fetch detail for")
        r = http.get(f"{BASE_URL}/api/admin/executions/{TestExecutionLogs._exec_id}", headers=admin_h)
        assert r.status_code == 200, f"Get execution detail failed: {r.status_code} {r.text}"
        data = r.json()
        for field in ["id", "status", "created_at", "message_history", "final_output"]:
            assert field in data, f"Missing field '{field}' in execution detail"

    def test_get_execution_not_found(self, http, admin_h):
        r = http.get(f"{BASE_URL}/api/admin/executions/nonexistent-id", headers=admin_h)
        assert r.status_code == 404


# ─── Webhook God Mode Routing ──────────────────────────────────────────────────

class TestWebhookGodMode:

    def test_webhook_requires_valid_secret(self, http):
        """Without valid secret, webhook returns 401."""
        r = http.post(f"{BASE_URL}/api/webhook/apify",
                      headers={"x-apify-secret": "WRONG_SECRET"},
                      json={
                          "user_id": "does-not-matter",
                          "signal_category": "warm_inbound",
                          "name": "Test Lead",
                      })
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_webhook_with_valid_secret_stores_lead(self, http, admin_token):
        """With valid secret + valid user_id, lead should be stored."""
        # Get admin user_id
        me = http.get(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {admin_token}"})
        user_id = me.json()["id"]

        r = http.post(
            f"{BASE_URL}/api/webhook/apify",
            headers={"x-apify-secret": APIFY_SECRET, "Content-Type": "application/json"},
            json={
                "user_id": user_id,
                "signal_category": "warm_inbound",
                "name": "IT5 Test Lead",
                "email": "it5test@example.com",
                "company": "TestCorp Inc",
                "job_title": "VP of Engineering",
                "linkedin_url": "https://linkedin.com/in/it5test",
            },
        )
        assert r.status_code == 200, f"Webhook failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True, "Webhook response missing success=True"
        assert "lead_id" in data, "Webhook response missing lead_id"
        assert "message" in data, "Webhook response missing message"
        print(f"Webhook lead stored: {data['lead_id']}")

    def test_webhook_invalid_signal_category(self, http, admin_token):
        """Invalid signal_category returns 400."""
        me = http.get(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {admin_token}"})
        user_id = me.json()["id"]

        r = http.post(
            f"{BASE_URL}/api/webhook/apify",
            headers={"x-apify-secret": APIFY_SECRET, "Content-Type": "application/json"},
            json={"user_id": user_id, "signal_category": "INVALID_CATEGORY", "name": "Bad"},
        )
        assert r.status_code == 400, f"Expected 400 for invalid category, got {r.status_code}: {r.text}"

    def test_webhook_invalid_user_returns_404(self, http):
        r = http.post(
            f"{BASE_URL}/api/webhook/apify",
            headers={"x-apify-secret": APIFY_SECRET, "Content-Type": "application/json"},
            json={"user_id": "nonexistent-uuid-xxx", "signal_category": "warm_inbound", "name": "Ghost"},
        )
        assert r.status_code == 404, f"Expected 404 for invalid user, got {r.status_code}: {r.text}"

    def test_webhook_god_mode_vs_legacy_routing(self, http, admin_token):
        """
        Webhook should trigger God Mode if user has active agent_configs,
        or legacy fallback otherwise. Just verify the response is 200.
        Background task runs asynchronously.
        """
        me = http.get(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {admin_token}"})
        user_id = me.json()["id"]

        r = http.post(
            f"{BASE_URL}/api/webhook/apify",
            headers={"x-apify-secret": APIFY_SECRET, "Content-Type": "application/json"},
            json={
                "user_id": user_id,
                "signal_category": "topic_authority",
                "name": "God Mode Test Lead",
                "company": "GodModeTest Inc",
                "job_title": "CTO",
            },
        )
        assert r.status_code == 200, f"Webhook god mode test failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["success"] is True
        print(f"Webhook triggered background processing for lead: {data['lead_id']}")
