"""GoviHub OpenRouter Client — Async wrapper for OpenRouter API (LLM calls)."""

import asyncio
from dataclasses import dataclass
from typing import Optional

import httpx
import structlog

from app.config import settings
from app.exceptions import ExternalServiceError

logger = structlog.get_logger()


@dataclass
class LLMUsage:
    input_tokens: int
    output_tokens: int


@dataclass
class LLMResponse:
    content: str
    usage: LLMUsage
    model: str


class OpenRouterClient:
    """Async client for OpenRouter API with retry and rate limit handling."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        max_retries: int = 3,
    ):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL
        self.base_url = base_url or settings.OPENROUTER_BASE_URL
        self.max_retries = max_retries

    async def chat(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        system: Optional[str] = None,
    ) -> LLMResponse:
        """Send a chat completion request to OpenRouter.

        Args:
            messages: List of {"role": str, "content": str} message dicts.
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature.
            system: Optional system message (prepended to messages).

        Returns:
            LLMResponse with content, usage, and model info.

        Raises:
            ExternalServiceError: On API failure after retries.
        """
        if system:
            messages = [{"role": "system", "content": system}] + messages

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.APP_URL,
            "X-Title": settings.APP_NAME,
        }

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                    if response.status_code == 429:
                        # Rate limited — exponential backoff
                        wait = 2**attempt
                        logger.warning(
                            "openrouter_rate_limited",
                            attempt=attempt + 1,
                            wait_seconds=wait,
                        )
                        await asyncio.sleep(wait)
                        continue

                    response.raise_for_status()
                    data = response.json()

                    usage = data.get("usage", {})
                    llm_response = LLMResponse(
                        content=data["choices"][0]["message"]["content"],
                        usage=LLMUsage(
                            input_tokens=usage.get("prompt_tokens", 0),
                            output_tokens=usage.get("completion_tokens", 0),
                        ),
                        model=data.get("model", self.model),
                    )

                    logger.info(
                        "openrouter_request",
                        model=llm_response.model,
                        input_tokens=llm_response.usage.input_tokens,
                        output_tokens=llm_response.usage.output_tokens,
                    )
                    return llm_response

            except httpx.HTTPStatusError as e:
                last_error = e
                logger.error(
                    "openrouter_http_error",
                    status=e.response.status_code,
                    attempt=attempt + 1,
                )
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2**attempt)
            except httpx.RequestError as e:
                last_error = e
                logger.error(
                    "openrouter_request_error",
                    error=str(e),
                    attempt=attempt + 1,
                )
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2**attempt)

        raise ExternalServiceError(
            detail=f"OpenRouter API failed after {self.max_retries} retries: {last_error}"
        )


# Default client singleton
openrouter_client = OpenRouterClient()
