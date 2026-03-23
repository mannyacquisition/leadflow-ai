"""
Universal Tool Executor
Supports: REST, GraphQL, OAuth2, Browser (Playwright), SMTP, Webhook
Includes auto-retry on timeout and error edge routing.
"""
import os
import json
import asyncio
from typing import Any, Optional

import httpx

from utils.auth import decrypt_api_key


MAX_RETRIES = 3
TIMEOUT = 30.0


def _decrypt_headers(encrypted: Optional[str]) -> dict:
    if not encrypted:
        return {}
    try:
        raw = decrypt_api_key(encrypted)
        return json.loads(raw)
    except Exception:
        return {}


async def execute_tool(
    tool: dict,
    input_data: dict,
    user_context: Optional[dict] = None,
) -> dict:
    """
    Execute a tool from the registry.
    tool: dict from ToolRegistry row
    input_data: dynamic parameters from agent
    user_context: {"user_id": str, "user": User model} for credential passthrough
    Returns: {"success": bool, "output": any, "error": str | None}
    """
    integration_type = (tool.get("integration_type") or "rest").lower()

    # Gap 2: use_user_credential passthrough
    if tool.get("use_user_credential") and user_context:
        cred_key = tool.get("credential_key", "")
        user_obj = user_context.get("user")
        if cred_key == "apify_api_token" and user_obj:
            try:
                from utils.auth import decrypt_api_key
                raw_token = decrypt_api_key(user_obj.apify_api_token_encrypted or "")
                # Inject token into a copy of tool dict so original is unchanged
                tool = dict(tool)
                import json as _j
                tool["auth_headers_encrypted"] = None
                # We store the token directly for _execute_apify to pick up
                tool["_resolved_token"] = raw_token
            except Exception:
                pass

    try:
        if integration_type == "rest":
            return await _execute_rest(tool, input_data)
        elif integration_type == "graphql":
            return await _execute_graphql(tool, input_data)
        elif integration_type == "browser":
            return await _execute_browser(tool, input_data)
        elif integration_type == "smtp":
            return await _execute_smtp(tool, input_data)
        elif integration_type in ("oauth2", "oauth"):
            return await _execute_oauth2_rest(tool, input_data)
        elif integration_type == "webhook":
            return await _execute_rest(tool, input_data, method="POST")
        elif integration_type == "apify":
            return await _execute_apify(tool, input_data)
        elif integration_type == "internal":
            # Dispatched via internal_tool_executor — should not reach here directly
            return {"success": False, "output": None, "error": "Internal tools must be called via MonaraEngine"}
        else:
            return {"success": False, "output": None, "error": f"Unknown integration type: {integration_type}"}
    except Exception as e:
        return {"success": False, "output": None, "error": str(e)}


async def _execute_rest(tool: dict, input_data: dict, method: str = "GET") -> dict:
    url = tool.get("endpoint_url", "")
    headers = _decrypt_headers(tool.get("auth_headers_encrypted"))
    headers.setdefault("Content-Type", "application/json")

    # Override method from schema if provided
    schema = tool.get("openapi_schema") or {}
    if schema.get("method"):
        method = schema["method"].upper()

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                if method in ("POST", "PUT", "PATCH"):
                    response = await client.request(method, url, json=input_data, headers=headers)
                else:
                    response = await client.request(method, url, params=input_data, headers=headers)

            response.raise_for_status()
            try:
                output = response.json()
            except Exception:
                output = response.text
            return {"success": True, "output": output, "error": None}

        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                return {"success": False, "output": None, "error": "Request timed out after retries"}
        except httpx.HTTPStatusError as e:
            return {"success": False, "output": None, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}


async def _execute_graphql(tool: dict, input_data: dict) -> dict:
    url = tool.get("endpoint_url", "")
    headers = _decrypt_headers(tool.get("auth_headers_encrypted"))
    headers.setdefault("Content-Type", "application/json")

    schema = tool.get("openapi_schema") or {}
    query = schema.get("query") or input_data.get("query", "")
    variables = input_data.get("variables", {})

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(
                    url,
                    json={"query": query, "variables": variables},
                    headers=headers,
                )
            response.raise_for_status()
            data = response.json()
            if "errors" in data:
                return {"success": False, "output": data, "error": str(data["errors"])}
            return {"success": True, "output": data.get("data"), "error": None}

        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                return {"success": False, "output": None, "error": "GraphQL request timed out"}


async def _execute_oauth2_rest(tool: dict, input_data: dict) -> dict:
    """Execute REST call with OAuth2 Bearer token."""
    oauth_cfg = {}
    if tool.get("oauth_config_encrypted"):
        try:
            oauth_cfg = json.loads(decrypt_api_key(tool["oauth_config_encrypted"]))
        except Exception:
            pass

    access_token = oauth_cfg.get("access_token", "")
    headers = _decrypt_headers(tool.get("auth_headers_encrypted"))

    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    return await _execute_rest({**tool, "auth_headers_encrypted": None}, input_data)


async def _execute_browser(tool: dict, input_data: dict) -> dict:
    """Playwright browser automation."""
    try:
        from playwright.async_api import async_playwright

        url = input_data.get("url") or tool.get("endpoint_url", "")
        action = input_data.get("action", "scrape")  # scrape | click | fill | screenshot

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)

            if action == "scrape":
                content = await page.content()
                text = await page.inner_text("body")
                result = {"url": url, "text": text[:5000], "html_length": len(content)}
            elif action == "screenshot":
                screenshot = await page.screenshot(type="png")
                import base64
                result = {"screenshot_b64": base64.b64encode(screenshot).decode()}
            elif action == "click":
                selector = input_data.get("selector", "")
                await page.click(selector)
                await page.wait_for_load_state("networkidle")
                text = await page.inner_text("body")
                result = {"text": text[:3000]}
            else:
                result = {"content": await page.inner_text("body")}

            await browser.close()
            return {"success": True, "output": result, "error": None}

    except ImportError:
        return {"success": False, "output": None, "error": "Playwright not installed. Run: pip install playwright && playwright install chromium"}
    except Exception as e:
        return {"success": False, "output": None, "error": f"Browser error: {str(e)}"}


async def _execute_smtp(tool: dict, input_data: dict) -> dict:
    """Send email via SMTP."""
    import smtplib
    from email.mime.text import MIMEText

    headers = _decrypt_headers(tool.get("auth_headers_encrypted"))
    host = headers.get("smtp_host", "smtp.gmail.com")
    port = int(headers.get("smtp_port", 587))
    username = headers.get("smtp_user", "")
    password = headers.get("smtp_password", "")

    to_email = input_data.get("to", "")
    subject = input_data.get("subject", "")
    body = input_data.get("body", "")

    try:
        msg = MIMEText(body, "html" if "<" in body else "plain")
        msg["Subject"] = subject
        msg["From"] = username
        msg["To"] = to_email

        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(username, password)
            server.sendmail(username, to_email, msg.as_string())

        return {"success": True, "output": {"sent_to": to_email}, "error": None}
    except Exception as e:
        return {"success": False, "output": None, "error": f"SMTP error: {str(e)}"}


async def _execute_apify(tool: dict, input_data: dict) -> dict:
    """
    Execute an Apify actor run and poll for results.
    tool.endpoint_url should be the actor ID (e.g. "lhotanova~google-news-scraper").
    tool auth_headers should contain {"Authorization": "Bearer <apify_token>"}.
    input_data is passed as the actor run input body.
    """
    headers = _decrypt_headers(tool.get("auth_headers_encrypted"))
    actor_id = tool.get("endpoint_url", "").strip("/")
    if not actor_id:
        return {"success": False, "output": None, "error": "Apify actor ID (endpoint_url) not set"}

    # Support use_user_credential passthrough (Gap 2)
    token = (
        tool.get("_resolved_token")
        or headers.get("token")
        or headers.get("x-apify-token")
        or headers.get("Authorization", "").replace("Bearer ", "")
    )
    if not token:
        return {"success": False, "output": None, "error": "Apify token not configured in auth_headers"}

    schema = tool.get("openapi_schema") or {}
    max_items = schema.get("max_items", 5)
    poll_timeout = schema.get("poll_timeout_seconds", 60)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Start actor run
            run_resp = await client.post(
                f"https://api.apify.com/v2/acts/{actor_id}/runs",
                params={"token": token},
                json=input_data,
            )
            if run_resp.status_code not in (200, 201):
                return {"success": False, "output": None, "error": f"Apify start failed: {run_resp.status_code} {run_resp.text[:200]}"}

            run_id = run_resp.json().get("data", {}).get("id")
            if not run_id:
                return {"success": False, "output": None, "error": "No run ID returned from Apify"}

            # Poll for completion
            elapsed = 0
            while elapsed < poll_timeout:
                await asyncio.sleep(2)
                elapsed += 2
                status_resp = await client.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": token},
                )
                if status_resp.status_code == 200:
                    run_status = status_resp.json().get("data", {}).get("status", "")
                    if run_status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                        break

            if run_status != "SUCCEEDED":
                return {"success": False, "output": None, "error": f"Apify actor run ended with status: {run_status}"}

            # Fetch dataset items
            items_resp = await client.get(
                f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items",
                params={"token": token, "limit": max_items},
            )
            items_resp.raise_for_status()
            items = items_resp.json()
            return {"success": True, "output": items, "error": None}

    except httpx.TimeoutException:
        return {"success": False, "output": None, "error": "Apify request timed out"}
    except Exception as e:
        return {"success": False, "output": None, "error": str(e)}


def format_tool_for_claude(tool: dict) -> dict:
    """Format a tool registry entry as a Claude tool definition."""
    schema = tool.get("openapi_schema") or {}
    return {
        "name": tool["name"].replace(" ", "_").lower(),
        "description": tool.get("description", ""),
        "input_schema": schema.get("input_schema") or {
            "type": "object",
            "properties": {"input": {"type": "string", "description": "Tool input"}},
            "required": ["input"],
        },
    }


def format_tool_for_openai(tool: dict) -> dict:
    """Format a tool registry entry as an OpenAI function tool definition."""
    schema = tool.get("openapi_schema") or {}
    return {
        "type": "function",
        "function": {
            "name": tool["name"].replace(" ", "_").lower(),
            "description": tool.get("description", ""),
            "parameters": schema.get("input_schema") or {
                "type": "object",
                "properties": {"input": {"type": "string"}},
                "required": ["input"],
            },
        },
    }
