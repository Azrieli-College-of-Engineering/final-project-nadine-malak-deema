Malak Ashhab 325243590
Nadine Batarseh 213327471
Deema Dwayat 324868470

## description

The project demonstrates a DOM-Based Cross-Site Scripting (XSS) vulnerability in a simulated student web dashboard and analyzes the effect of different Content Security Policy (CSP) configurations on exploitability.

The system intentionally includes a vulnerable DOM sink using innerHTML, allowing attacker-controlled input from a URL parameter to be injected into the page without sanitization.

The project simulates a real-world security scenario where an authentication token (auth_token) is stored in localStorage, and demonstrates how improper client-side handling can lead to sensitive data exposure.

The experiment includes multiple versions of CSP configurations to evaluate protection effectiveness.


## Functions

1. URLSearchParams : Reads attacker-controlled input from the URL parameter (?report=).
2. document.getElementById().innerHTML : Vulnerable DOM sink that renders unsanitized HTML.
3. stealToken() : JavaScript function that retrieves auth_token from localStorage and exfiltrates it to the attacker server using an Image request.
4. localStorage.getItem() : Accesses stored authentication token.
5. new Image().src : Sends the stolen token to the attacker server as a query parameter, bypassing CORS restrictions.
6. Attacker Server (Node.js) : Receives and logs stolen tokens. Runs two servers simultaneously — victim app on port 8080, attacker capture server on port 9000.
7. Server-Sent Events (SSE) : The attacker /view page updates in real-time without requiring a page refresh.
8. CSP Configurations :
    - V1 – No CSP
    - V2 – Weak CSP (unsafe-inline allowed)
    - V3 – Strict CSP (nonce-based, blocks inline event handlers)
    - V4 – Secure implementation using textContent
9. textContent : Secure alternative to innerHTML that prevents HTML parsing and code execution.
10. addLog() : Logs browser-side security events for demonstration purposes.


## Program Files

src/login.html
    Login page with simulated JWT token generation stored in localStorage.

src/index.html
    Hub page linking to all four experiment versions.

src/dashboard-v1-no-csp.html
    Fully vulnerable version without any CSP protection.

src/dashboard-v2-weak-csp.html
    Version with weak CSP (unsafe-inline) — XSS still executes, token exfiltrated to attacker server.

src/dashboard-v3-strict-csp.html
    Version with strict nonce-based CSP — inline event handlers blocked, stealToken() never executes.

src/dashboard-v4-secure.html
    Secure implementation replacing innerHTML with textContent — no HTML parsed, no XSS possible.

src/server.js
    Node.js server that runs two HTTP servers:
    - Port 8080: serves all static HTML/CSS files (victim app)
    - Port 9000: attacker endpoint that captures stolen tokens and provides a live dashboard at /view

src/shared.css
    Common styling for all dashboard versions.


## How to Run

1. Install Node.js if not already installed.

2. Navigate to the src directory:

   cd final-project-nadine-malak-deema/src

3. Start both servers with a single command:

   node server.js

   This starts:
   - Victim app:      http://localhost:8080
   - Attacker server: http://localhost:9000

4. Open the victim app in a browser (must use the server URL, not the file path):

   http://localhost:8080/login.html

   Login credentials:
   - Username: student
   - Password: 1234

5. Navigate to one of the dashboard versions and inject the payload:

   <img src=x onerror=stealToken()>

6. Open the attacker live dashboard in a second tab to see captured tokens in real-time:

   http://localhost:9000/view

   The page updates automatically without refreshing.

7. Test V3 and V4 to observe blocked attacks:
   - V3: A banner appears on the page confirming CSP blocked the inline event handler.
   - V4: A banner appears confirming the payload was rendered as plain text (no XSS).
   - In both cases, nothing arrives at localhost:9000/view — confirming the attack was stopped.


## Input

- URL parameter ?report= containing attacker-controlled payload.
- Injected HTML payload such as:

  <img src=x onerror=stealToken()>


## Output

- Execution of injected JavaScript in vulnerable versions (V1, V2).
- Authentication token (auth_token) accessed from localStorage.
- Token captured and displayed in real-time in the attacker server terminal and at localhost:9000/view.
- CSP enforcement behavior depending on configuration version.
- Visual blocked banners on V3 and V4 pages when a token theft payload is attempted.


## Security Demonstrated

- DOM-Based XSS vulnerability.
- Impact of unsafe use of innerHTML.
- Risks of storing authentication tokens in localStorage.
- False sense of security from misconfigured CSP (unsafe-inline).
- Effectiveness of properly configured nonce-based CSP.
- Secure coding mitigation using textContent.
- Real-world token exfiltration technique using Image requests to bypass CORS.
