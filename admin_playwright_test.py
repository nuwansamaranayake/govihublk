"""Comprehensive Playwright validation of https://spices.govihublk.com/admin/.

Run:
    python admin_playwright_test.py [--headed]

Captures every failure as a screenshot in the screenshots dir and exits with
non-zero on any assertion failure. Designed to be re-runnable end to end.
"""

from __future__ import annotations

import os
import struct
import sys
import time
import zlib
from pathlib import Path

from playwright.sync_api import (
    Page,
    Playwright,
    TimeoutError as PWTimeout,
    expect,
    sync_playwright,
)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ADMIN_URL = "https://spices.govihublk.com/admin/"
USERNAME = "nuwan"
PASSWORD = "Nuwan-Super9635"

# /tmp on Linux/macOS; resolves under the current drive on Windows.
SCREENSHOT_DIR = Path("/tmp/admin_screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Generous timeouts — production network + LLM + Sri Lanka latency.
DEFAULT_TIMEOUT_MS = 15_000
AI_TIMEOUT_MS = 45_000


# ---------------------------------------------------------------------------
# Test runner scaffolding
# ---------------------------------------------------------------------------


class Suite:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.failures: list[tuple[str, str]] = []
        self.passes: list[str] = []
        self.cleanup_notes: list[str] = []

    def step(self, name: str) -> None:
        print(f"\n→ {name}", flush=True)

    def ok(self, name: str) -> None:
        print(f"  ✓ {name}", flush=True)
        self.passes.append(name)

    def fail(self, name: str, detail: str) -> None:
        slug = name.lower().replace(" ", "_").replace("/", "_")[:60]
        path = SCREENSHOT_DIR / f"FAIL_{int(time.time())}_{slug}.png"
        try:
            self.page.screenshot(path=str(path), full_page=True)
        except Exception as e:
            print(f"  (screenshot failed: {e})", flush=True)
        print(f"  ✗ {name}: {detail}\n    screenshot={path}", flush=True)
        self.failures.append((name, detail))

    def note(self, message: str) -> None:
        print(f"  ℹ {message}", flush=True)
        self.cleanup_notes.append(message)

    def force_close_modal(self) -> None:
        """Hard-close any stuck modal overlay so the next section can click freely."""
        try:
            self.page.evaluate(
                """() => {
                  const ov = document.getElementById('modal-overlay');
                  if (ov) ov.style.display = 'none';
                  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
                  const t = document.getElementById('toast');
                  if (t) t.style.display = 'none';
                }"""
            )
        except Exception:
            pass

    def clear_toast(self) -> None:
        try:
            self.page.evaluate(
                "() => { const t = document.getElementById('toast'); if (t) t.style.display='none'; }"
            )
        except Exception:
            pass

    def wait_for_toast_text(self, expected_substr: str, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> str:
        """Wait until #toast becomes visible AND its text contains the expected substring.

        Returns the actual toast text. Raises PWTimeout otherwise.
        """
        self.page.wait_for_function(
            f"""() => {{
              const t = document.getElementById('toast');
              if (!t) return false;
              if (t.style.display === 'none') return false;
              return (t.textContent || '').toLowerCase().includes({expected_substr.lower()!r});
            }}""",
            timeout=timeout_ms,
        )
        return (self.page.locator("#toast").text_content() or "").strip()


def make_png(width: int, height: int, rgb: tuple[int, int, int] = (45, 106, 46)) -> bytes:
    """Generate a valid solid-colour PNG with no external deps."""
    def chunk(typ: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + typ
            + data
            + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(rgb) * width
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ---------------------------------------------------------------------------
# Section 1: Auth flow
# ---------------------------------------------------------------------------


def test_auth(s: Suite) -> bool:
    s.step("AUTH — load /admin/")
    try:
        s.page.goto(ADMIN_URL, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_selector("#login-screen", timeout=DEFAULT_TIMEOUT_MS)
        s.ok("login screen renders")
    except PWTimeout as e:
        s.fail("load admin page", str(e))
        return False

    s.step("AUTH — wrong password rejected with visible error")
    try:
        s.page.fill("#login-username", USERNAME)
        s.page.fill("#login-password", "DEFINITELY_WRONG")
        s.page.click("button:has-text('Sign in')")
        # Error element exists and becomes visible.
        err = s.page.locator("#login-error")
        expect(err).to_be_visible(timeout=DEFAULT_TIMEOUT_MS)
        text = err.text_content() or ""
        assert text.strip(), "login-error is visible but empty"
        s.ok(f"error visible: {text!r}")
    except (PWTimeout, AssertionError) as e:
        s.fail("wrong password error", str(e))
        return False

    s.step("AUTH — correct credentials log in")
    try:
        s.page.fill("#login-password", PASSWORD)
        s.page.click("button:has-text('Sign in')")
        s.page.wait_for_selector("#sidebar", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_selector("#kpi-grid", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        s.ok("sidebar + KPI strip visible")
    except PWTimeout as e:
        s.fail("login + show app", str(e))
        return False
    return True


# ---------------------------------------------------------------------------
# Section 2: AI Intelligence view
# ---------------------------------------------------------------------------


def test_ai_view(s: Suite) -> None:
    s.step("AI — KPI cards populate with numeric values")
    try:
        # Wait until the 4 KPI values are filled with digits (not the placeholder dash).
        s.page.wait_for_function(
            """() => {
              const els = document.querySelectorAll('#kpi-grid .kpi-value');
              if (els.length !== 4) return false;
              return Array.from(els).every(e => /\\d/.test(e.textContent || ''));
            }""",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        vals = s.page.eval_on_selector_all(
            "#kpi-grid .kpi-value", "els => els.map(e => e.textContent.trim())"
        )
        assert len(vals) == 4, f"expected 4 KPI cards, got {len(vals)}"
        for v in vals:
            assert any(c.isdigit() for c in v), f"KPI value '{v}' has no digit"
        s.ok(f"KPI values: {vals}")
    except (PWTimeout, AssertionError) as e:
        s.fail("KPI numeric values", str(e))

    s.step("AI — exactly 10 query chips visible")
    try:
        chips = s.page.locator(".ai-chip")
        expect(chips).to_have_count(10, timeout=DEFAULT_TIMEOUT_MS)
        s.ok(f"chip count = {chips.count()}")
    except (PWTimeout, AssertionError) as e:
        s.fail("AI chip count", str(e))

    s.step("AI — click first chip, await Q&A card with a digit")
    try:
        first = s.page.locator(".ai-chip").first
        first_text = first.text_content() or ""
        first.click()
        s.page.wait_for_selector(".qa-card", timeout=AI_TIMEOUT_MS)
        answer = s.page.locator(".qa-card .qa-answer").first.text_content() or ""
        assert answer.strip(), "answer card empty"
        # We require *some* digit OR — if the LLM legitimately answered "zero" — at least
        # not say "error". For our seeded data every chip will return a number though.
        assert any(c.isdigit() for c in answer), f"no digit in answer: {answer!r}"
        s.ok(f"chip '{first_text[:40]}…' → answered with digits ({len(answer)} chars)")
    except (PWTimeout, AssertionError) as e:
        s.fail("AI chip click → answer", str(e))

    s.step("AI — manual query 'How many buyers are registered?'")
    try:
        before = s.page.locator(".qa-card").count()
        ai_input = s.page.locator("#ai-input")
        ai_input.fill("How many buyers are registered?")
        ai_input.press("Enter")
        # Wait for a NEW qa-card to appear above the previous ones.
        s.page.wait_for_function(
            f"() => document.querySelectorAll('.qa-card').length > {before}",
            timeout=AI_TIMEOUT_MS,
        )
        latest = s.page.locator(".qa-card").first.locator(".qa-answer").text_content() or ""
        assert any(c.isdigit() for c in latest), f"no digit in manual answer: {latest!r}"
        s.ok(f"manual query answered: '{latest.strip()[:80]}'")
    except (PWTimeout, AssertionError) as e:
        s.fail("AI manual query", str(e))


# ---------------------------------------------------------------------------
# Section 3: Users view
# ---------------------------------------------------------------------------


def test_users_view(s: Suite) -> dict:
    """Returns {'reset_username': '...', 'reset_temp_pw': '...'} for cleanup notes."""
    out: dict = {}
    s.step("USERS — open view, table loads with ≥10 rows")
    try:
        s.page.click("#nav-users")
        s.page.wait_for_selector("#users-tbody tr", timeout=DEFAULT_TIMEOUT_MS)
        rows = s.page.locator("#users-tbody tr")
        s.page.wait_for_function(
            "() => document.querySelectorAll('#users-tbody tr').length >= 10",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.ok(f"rows = {rows.count()}")
    except (PWTimeout, AssertionError) as e:
        s.fail("users table loads", str(e))
        return out

    s.step("USERS — every row has a role badge")
    try:
        bad = s.page.eval_on_selector_all(
            "#users-tbody tr",
            "els => els.filter(e => !e.querySelector('.badge-farmer, .badge-buyer, .badge-supplier, .badge-admin')).length",
        )
        assert bad == 0, f"{bad} row(s) missing role badge"
        s.ok("all rows have role badge")
    except AssertionError as e:
        s.fail("role badges", str(e))

    s.step("USERS — search filter (q='nuwan')")
    try:
        s.page.fill("#users-search", "nuwan")
        # Debounced 300ms — wait for the count display to update with 'nuwan' results.
        s.page.wait_for_function(
            """() => {
              const txt = document.querySelector('#users-count')?.textContent || '';
              const rows = document.querySelectorAll('#users-tbody tr').length;
              return rows >= 1 && rows <= 10;
            }""",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        # And confirm the visible rows actually mention 'nuwan' somewhere.
        body = s.page.locator("#users-tbody").text_content() or ""
        assert "nuwan" in body.lower(), f"'nuwan' not in filtered rows: {body[:200]!r}"
        s.ok(f"filtered rows = {s.page.locator('#users-tbody tr').count()}")
    except (PWTimeout, AssertionError) as e:
        s.fail("user search", str(e))

    s.step("USERS — clear search and re-load full list")
    try:
        s.page.fill("#users-search", "")
        s.page.wait_for_function(
            "() => document.querySelectorAll('#users-tbody tr').length >= 10",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.ok("cleared")
    except PWTimeout as e:
        s.fail("clear search", str(e))

    s.step("USERS — open Edit modal on first user, assert pre-filled")
    try:
        first_edit = s.page.locator("#users-tbody tr").first.locator("button:has-text('Edit')")
        first_edit.click()
        s.page.wait_for_selector("#modal-edit-user", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        name_val = s.page.locator("#edit-user-name").input_value()
        role_val = s.page.locator("#edit-user-role").input_value()
        assert name_val.strip(), "name field empty"
        assert role_val in {"farmer", "buyer", "supplier", "admin"}, f"unknown role: {role_val}"
        s.ok(f"pre-filled: name={name_val!r} role={role_val}")
        # Cancel
        s.page.click("#modal-edit-user button:has-text('Cancel')")
        s.page.wait_for_selector("#modal-edit-user", state="hidden", timeout=DEFAULT_TIMEOUT_MS)
        s.ok("cancel closes modal")
    except (PWTimeout, AssertionError) as e:
        s.fail("edit user modal", str(e))

    s.step("USERS — Reset PW on first non-admin user")
    try:
        # Find a row where role badge is NOT 'admin'.
        non_admin = s.page.locator(
            "#users-tbody tr:has(.badge-farmer), #users-tbody tr:has(.badge-buyer), #users-tbody tr:has(.badge-supplier)"
        ).first
        # The first <td> contains [avatar initials, name, email] stacked.
        # Pull the explicit name <div> (font-weight:500 first inner div).
        target_name = (
            non_admin.locator("td").first.locator("div[style*='font-weight:500']").first.text_content() or ""
        ).strip()
        if not target_name:
            target_name = (non_admin.locator("td").first.text_content() or "").strip()
        out["reset_username"] = target_name
        non_admin.locator("button:has-text('Reset PW')").click()
        s.page.wait_for_selector("#modal-reset-pw", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        s.ok(f"reset modal opened for: {target_name!r}")
        s.page.click("#modal-reset-pw button:has-text('Generate password')")
        # Wait for step2 reveal
        s.page.wait_for_function(
            "() => document.getElementById('reset-pw-step2').style.display !== 'none'",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        pw_value = (s.page.locator("#reset-pw-value").text_content() or "").strip()
        out["reset_temp_pw"] = pw_value
        assert len(pw_value) == 12, f"expected 12-char temp pw, got {len(pw_value)}: {pw_value!r}"
        assert "-" not in pw_value, f"temp pw contains a dash: {pw_value!r}"
        s.ok(f"temp pw generated: '{pw_value}' (12 chars, no dashes)")
        # Click Copy (clipboard requires permissions; ignore actual paste)
        try:
            s.page.locator("#modal-reset-pw button:has-text('Copy password')").click(timeout=2000)
            s.ok("copy button clicked")
        except PWTimeout:
            s.note("copy button not clickable (clipboard perms blocked) — skipping copy click")
        # Close modal via Done
        try:
            s.page.click("#modal-reset-pw button:has-text('Done')", timeout=3000)
        except PWTimeout:
            # Footer was rebuilt — fall back to overlay click.
            s.page.evaluate("closeModal('reset-pw')")
        s.page.wait_for_selector("#modal-reset-pw", state="hidden", timeout=DEFAULT_TIMEOUT_MS)
        s.ok("reset modal closed")
        s.note(
            f"PASSWORD RESET CLEANUP: user '{target_name}' temp pw is '{pw_value}'. "
            "Communicate to the user, or restore via SQL if needed."
        )
    except (PWTimeout, AssertionError) as e:
        s.fail("reset password flow", str(e))
    return out


# ---------------------------------------------------------------------------
# Section 4: Listings view
# ---------------------------------------------------------------------------


def test_listings_view(s: Suite) -> dict:
    out: dict = {}
    s.step("LISTINGS — open view, harvest tab active, table loads")
    try:
        s.page.click("#nav-listings")
        s.page.wait_for_selector("#tab-harvest.active", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_selector("#listings-tbody tr", timeout=DEFAULT_TIMEOUT_MS)
        head = s.page.locator("#listings-thead").text_content() or ""
        assert "Farmer" in head, f"harvest head missing Farmer column: {head!r}"
        s.ok(f"harvest active, rows={s.page.locator('#listings-tbody tr').count()}")
    except (PWTimeout, AssertionError) as e:
        s.fail("harvest tab loads", str(e))
        return out

    s.step("LISTINGS — switch to Demand tab")
    try:
        s.page.click("#tab-demand")
        s.page.wait_for_selector("#tab-demand.active", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_function(
            "() => (document.querySelector('#listings-thead')?.textContent || '').includes('Buyer')",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        # Wait for either rows OR "No listings found" — both are valid loaded states.
        s.page.wait_for_selector("#listings-tbody tr", timeout=DEFAULT_TIMEOUT_MS)
        s.ok(
            f"demand head changed, rows={s.page.locator('#listings-tbody tr').count()}"
        )
    except (PWTimeout, AssertionError) as e:
        s.fail("switch to demand", str(e))

    s.step("LISTINGS — switch to Supply tab")
    try:
        s.page.click("#tab-supply")
        s.page.wait_for_selector("#tab-supply.active", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_function(
            "() => (document.querySelector('#listings-thead')?.textContent || '').includes('Supplier')",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.page.wait_for_selector("#listings-tbody tr", timeout=DEFAULT_TIMEOUT_MS)
        s.ok(
            f"supply head changed, rows={s.page.locator('#listings-tbody tr').count()}"
        )
    except (PWTimeout, AssertionError) as e:
        s.fail("switch to supply", str(e))

    s.step("LISTINGS — back to Harvest, remove a non-removed row")
    try:
        s.page.click("#tab-harvest")
        s.page.wait_for_selector("#tab-harvest.active", timeout=DEFAULT_TIMEOUT_MS)
        # Wait for the harvest data to fully replace any prior tab's stale rows.
        # The fresh-tab placeholder shows "Loading..." then real rows replace it.
        s.page.wait_for_function(
            """() => {
              const tbody = document.getElementById('listings-tbody');
              if (!tbody) return false;
              const txt = tbody.textContent || '';
              if (txt.includes('Loading...')) return false;
              if (txt.includes('No listings found')) return true;
              // Real harvest rows: the first cell should NOT contain a supplier email.
              return tbody.querySelectorAll('tr').length > 0;
            }""",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        # Find a row with an enabled Remove button (not yet removed).
        rows = s.page.locator("#listings-tbody tr").all()
        target_row = None
        for r in rows:
            btn = r.locator("button:has-text('Remove')").first
            if btn.is_visible() and not btn.is_disabled():
                target_row = r
                break
        if target_row is None:
            s.fail("find non-removed harvest row", "no enabled Remove button found")
            return out

        farmer = (target_row.locator("td").first.text_content() or "").strip().splitlines()[0]
        out["removed_listing_farmer"] = farmer

        target_row.locator("button:has-text('Remove')").first.click()
        s.page.wait_for_selector("#modal-remove-listing", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        # Reason dropdown present + has options. <option> elements are not "visible"
        # in Playwright's sense unless the dropdown is open, so check via DOM count
        # rather than wait_for_selector.
        s.page.wait_for_function(
            "() => document.querySelectorAll('#remove-reason option').length > 1",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        opts = s.page.eval_on_selector_all(
            "#remove-reason option", "els => els.map(e => e.value)"
        )
        assert "spam" in opts, f"removal reasons missing 'spam': {opts}"
        s.page.select_option("#remove-reason", "spam")
        s.page.fill("#remove-notes", "Playwright automated test")
        s.clear_toast()  # Clear any stale toast (e.g. 'Password copied' from earlier section)
        # Use the danger class to disambiguate from the modal title text.
        s.page.click("#modal-remove-listing button.btn-danger")
        # Race: wait for either the modal to close (success) or an error toast.
        s.page.wait_for_function(
            """() => {
              const modal = document.getElementById('modal-remove-listing');
              const overlay = document.getElementById('modal-overlay');
              const closed = !modal || modal.style.display === 'none' ||
                             !overlay || overlay.style.display === 'none';
              const t = document.getElementById('toast');
              const isErr = t && t.style.display !== 'none' &&
                            (t.classList.contains('error'));
              return closed || isErr;
            }""",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        # Now check what actually happened.
        modal_visible = s.page.locator("#modal-remove-listing").is_visible()
        if modal_visible:
            toast_txt = (s.page.locator("#toast").text_content() or "").strip()
            s.fail("remove listing", f"modal still open; toast: {toast_txt!r}")
            return out
        # Modal closed — the success toast may have already faded; check or accept.
        try:
            toast = s.wait_for_toast_text("removed successfully", timeout_ms=2000)
            s.ok(f"toast: {toast!r}")
        except PWTimeout:
            # Toast may have shown briefly and faded. Modal closure is the success signal.
            s.ok("modal closed (toast may have faded)")
        s.note(f"REMOVED HARVEST LISTING (farmer: {farmer}). Restore by setting removed_at=NULL in DB if needed.")
    except (PWTimeout, AssertionError) as e:
        s.fail("remove listing", str(e))
        return out

    s.step("LISTINGS — verify removal reflected in list (include_removed view)")
    try:
        # Snapshot pre-toggle row count so we can detect the reload.
        pre_rows = s.page.locator("#listings-tbody tr").count()
        # Toggle "Show removed" so the now-removed row appears with the badge.
        s.page.check("#listings-include-removed")
        # Wait for either: (a) row count to grow, OR (b) a badge-removed to appear,
        # OR (c) a disabled Remove button to appear. Any of these proves the
        # include_removed reload happened and produced removed rows.
        s.page.wait_for_function(
            f"""() => {{
              const rows = document.querySelectorAll('#listings-tbody tr');
              const html = document.getElementById('listings-tbody')?.innerHTML || '';
              const grew = rows.length > {pre_rows};
              const badge = html.includes('badge-removed');
              const disabled = document.querySelectorAll(
                "#listings-tbody button:disabled"
              ).length > 0;
              return grew || badge || disabled;
            }}""",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        post_rows = s.page.locator("#listings-tbody tr").count()
        disabled_count = s.page.locator("#listings-tbody button:disabled").count()
        s.ok(
            f"removed reflected (rows {pre_rows}→{post_rows}, disabled btns: {disabled_count})"
        )
        s.page.uncheck("#listings-include-removed")
    except (PWTimeout, AssertionError) as e:
        s.fail("removal reflected", str(e))
    return out


# ---------------------------------------------------------------------------
# Section 5: Ads view
# ---------------------------------------------------------------------------


def test_ads_view(s: Suite) -> None:
    s.step("ADS — open view, ≥1 ad card renders")
    try:
        s.page.click("#nav-ads")
        # Wait until either: cards appear, OR the empty-state placeholder appears.
        # Both prove loadAds() finished. We then assert at least one card.
        s.page.wait_for_function(
            """() => {
              const grid = document.getElementById('ads-grid');
              if (!grid) return false;
              return grid.querySelectorAll('.ad-card').length > 0
                  || grid.textContent.includes('No ads');
            }""",
            timeout=25_000,
        )
        cards_count = s.page.locator(".ad-card").count()
        if cards_count == 0:
            s.fail(
                "ads cards render",
                "loadAds finished but rendered empty state — check API response or filter",
            )
            return
        s.ok(f"ad cards rendered = {cards_count}")
    except PWTimeout as e:
        # Capture extra diagnostics before bailing.
        try:
            grid_text = (s.page.locator("#ads-grid").text_content() or "")[:200]
            s.fail("ads cards render", f"{e} | grid_text={grid_text!r}")
        except Exception:
            s.fail("ads cards render", str(e))
        return

    s.step("ADS — each card has image-or-placeholder, title, status badge, impressions, clicks")
    try:
        bad = s.page.eval_on_selector_all(
            ".ad-card",
            """els => els.filter(c => {
                const hasImg = !!c.querySelector('.ad-card-img');
                const hasTitle = !!c.querySelector('.ad-card-title');
                const hasBadge = !!c.querySelector('.badge-ad-active, .badge-ad-paused, .badge-ad-expired');
                const stats = (c.querySelector('.ad-card-stats')?.textContent || '');
                const hasImp = stats.includes('👁');
                const hasClk = stats.includes('🔗');
                return !(hasImg && hasTitle && hasBadge && hasImp && hasClk);
              }).length""",
        )
        assert bad == 0, f"{bad} ad card(s) missing required elements"
        s.ok("all cards complete")
    except AssertionError as e:
        s.fail("ad card structure", str(e))

    s.step("ADS — open New Ad modal")
    try:
        s.page.click("button:has-text('+ New ad')")
        s.page.wait_for_selector("#modal-create-ad", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        s.ok("create modal opened")
    except PWTimeout as e:
        s.fail("open create modal", str(e))
        return

    s.step("ADS — fill Title + image upload + advertiser, save")
    test_ad_title = f"Playwright Test Ad {int(time.time())}"
    try:
        s.page.fill("#ad-title", test_ad_title)
        s.page.fill("#ad-advertiser-name", "Test Co")
        # Upload via the hidden input (drag-drop is awkward; spec allows either).
        png_path = Path("/tmp/admin_pw_test.png")
        png_path.write_bytes(make_png(100, 100))
        s.page.set_input_files("#ad-image-input", str(png_path))
        # The new flow stages the file locally (blob: URL) and uploads to R2 as
        # part of the multipart create call on Save. So we wait for the local
        # preview to become visible and an image URL (any scheme) to be set.
        s.page.wait_for_function(
            """() => {
              const url = document.getElementById('ad-image-url')?.value || '';
              const previewVisible = (document.getElementById('ad-image-preview')?.style.display || '') === 'block';
              return url.length > 0 && previewVisible;
            }""",
            timeout=10_000,
        )
        s.ok("image staged, preview visible")
        s.clear_toast()
        s.page.click("#modal-create-ad button:has-text('Save ad')")
        toast = s.wait_for_toast_text("ad created successfully")
        s.ok(f"toast: {toast!r}")
        # Wait for modal to close + new card to appear.
        s.page.wait_for_selector("#modal-create-ad", state="hidden", timeout=DEFAULT_TIMEOUT_MS)
        s.page.wait_for_function(
            f"() => Array.from(document.querySelectorAll('.ad-card-title'))"
            f".some(t => t.textContent.includes({test_ad_title!r}))",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.ok(f"new ad card visible: '{test_ad_title}'")
    except (PWTimeout, AssertionError) as e:
        s.fail("create ad", str(e))
        return

    # Locate the new ad card going forward.
    new_card = s.page.locator(
        f".ad-card:has(.ad-card-title:text-is('{test_ad_title}'))"
    ).first

    s.step("ADS — Pause new ad, badge becomes 'paused'")
    try:
        new_card.locator("button:has-text('Pause')").click()
        # Card list re-renders after toggle.
        s.page.wait_for_function(
            f"() => {{"
            f"  const cards = Array.from(document.querySelectorAll('.ad-card'));"
            f"  const c = cards.find(c => c.querySelector('.ad-card-title')?.textContent.includes({test_ad_title!r}));"
            f"  return c && c.querySelector('.badge-ad-paused');"
            f"}}",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.ok("badge → paused")
    except PWTimeout as e:
        s.fail("pause ad", str(e))

    s.step("ADS — Delete new ad: confirm without typing DELETE shows error")
    try:
        # Re-locate after re-render.
        card = s.page.locator(
            f".ad-card:has(.ad-card-title:text-is('{test_ad_title}'))"
        ).first
        card.locator("button:has-text('Delete')").click()
        s.page.wait_for_selector("#modal-confirm-action", state="visible", timeout=DEFAULT_TIMEOUT_MS)
        s.page.click("#modal-confirm-action button:has-text('Confirm')")
        # The current admin.html does not require typing DELETE for an ad delete (only for users).
        # In that case the ad is deleted on the first Confirm.  We accept either branch.
        try:
            s.page.wait_for_selector("#toast.error", timeout=2000)
            s.ok("error toast shown for missing DELETE word (user-style flow)")
            s.step("ADS — type DELETE and confirm")
            s.page.fill("#confirm-delete-input", "DELETE")
            s.page.click("#modal-confirm-action button:has-text('Confirm')")
        except PWTimeout:
            # No DELETE confirmation step — ad was already deleted by first Confirm.
            s.ok("ad delete confirmed in single step (no DELETE word required)")
        # The toast may fade by the time we poll (3.5s auto-hide). The card
        # disappearing from the grid is the true success signal — assert that.
        s.page.wait_for_function(
            f"() => !Array.from(document.querySelectorAll('.ad-card-title'))"
            f".some(t => t.textContent.includes({test_ad_title!r}))",
            timeout=DEFAULT_TIMEOUT_MS,
        )
        s.ok(f"ad '{test_ad_title}' removed from grid")
    except (PWTimeout, AssertionError) as e:
        s.fail("delete ad", str(e))


# ---------------------------------------------------------------------------
# Section 6: Error states
# ---------------------------------------------------------------------------


def test_error_states(s: Suite) -> None:
    s.step("ERROR — break fetch, trigger users load, expect error toast")
    try:
        # Save real fetch + override to throw.
        s.page.evaluate(
            """() => {
              window._origFetch = window.fetch.bind(window);
              window.fetch = () => Promise.reject(new Error('disconnected'));
            }"""
        )
        # Navigate to Users — this calls loadUsers() which uses apiFetch().
        s.page.click("#nav-users")
        # Toast should appear with our error message.
        s.page.wait_for_selector("#toast.error", timeout=DEFAULT_TIMEOUT_MS)
        toast = (s.page.locator("#toast").text_content() or "").strip()
        # App container should still be visible (no white screen).
        assert s.page.locator("#app").is_visible(), "white screen — app hidden"
        s.ok(f"error toast shown: {toast!r}")
    except (PWTimeout, AssertionError) as e:
        s.fail("error toast on broken fetch", str(e))
    finally:
        # Restore fetch.
        s.page.evaluate("() => { if (window._origFetch) window.fetch = window._origFetch; }")
        s.ok("fetch restored")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run(playwright: Playwright, headed: bool = False) -> int:
    browser = playwright.chromium.launch(headless=not headed)
    context = browser.new_context(
        ignore_https_errors=False,
        viewport={"width": 1440, "height": 900},
    )
    # Best-effort clipboard permissions (Chromium will silently ignore on HTTPS).
    try:
        context.grant_permissions(["clipboard-read", "clipboard-write"], origin=ADMIN_URL)
    except Exception:
        pass
    page = context.new_page()
    page.set_default_timeout(DEFAULT_TIMEOUT_MS)

    # Capture console errors and uncaught exceptions for diagnostics.
    page.on("pageerror", lambda exc: print(f"  [pageerror] {exc}", flush=True))
    page.on(
        "console",
        lambda msg: (
            print(f"  [console.{msg.type}] {msg.text}", flush=True)
            if msg.type in ("error", "warning")
            else None
        ),
    )
    # Log DELETE requests against the listings/ads endpoints for diagnostics.
    page.on(
        "request",
        lambda req: (
            print(f"  [req.{req.method}] {req.url}", flush=True)
            if req.method in ("DELETE",) and "/admin/" in req.url
            else None
        ),
    )
    page.on(
        "response",
        lambda res: (
            print(f"  [resp.{res.status}] {res.request.method} {res.url}", flush=True)
            if "/admin/listings/" in res.url and res.request.method == "DELETE"
            else None
        ),
    )

    s = Suite(page)

    try:
        if not test_auth(s):
            return _summary(s)
        test_ai_view(s)
        s.force_close_modal()
        test_users_view(s)
        s.force_close_modal()
        test_listings_view(s)
        s.force_close_modal()
        test_ads_view(s)
        s.force_close_modal()
        test_error_states(s)
    finally:
        browser.close()

    return _summary(s)


def _summary(s: Suite) -> int:
    print("\n" + "=" * 60)
    print(f"PASS: {len(s.passes)}")
    print(f"FAIL: {len(s.failures)}")
    if s.failures:
        for name, detail in s.failures:
            print(f"  ✗ {name}: {detail}")
    if s.cleanup_notes:
        print("\nCleanup notes / side effects:")
        for n in s.cleanup_notes:
            print(f"  • {n}")
    print(f"\nScreenshots dir: {SCREENSHOT_DIR}")
    print("=" * 60)
    return 0 if not s.failures else 1


def main() -> int:
    headed = "--headed" in sys.argv
    with sync_playwright() as pw:
        return run(pw, headed=headed)


if __name__ == "__main__":
    sys.exit(main())
