import asyncio
import subprocess
import re
import asyncio
import subprocess
import re
import websockets
import json
import sys
import base64 # Needed for encoding/decoding response body
import aiohttp # Needed to fetch the target list

CDP_PORT = 32123
GAME_EXECUTABLE = 'LegendsOfIdleon.exe' # Assumes it's in PATH or current directory
INTERCEPT_PATTERN = '*N.js' # From config.js
TEST_MESSAGE = "console.log('Intercepted and modified by Python!');"

# Global command ID counter
command_id_counter = 1
# Store pending command responses
pending_commands = {}

async def find_page_websocket_url(process):
    """
    Reads stderr to find the browser DevTools URL, then queries it
    to find the specific WebSocket URL for the game page.
    """
    print("Waiting for browser DevTools WebSocket URL...")
    browser_ws_url = None
    while True:
        try:
            line_bytes = await process.stderr.readline()
            if not line_bytes:
                print("End of stderr reached without finding browser URL.", file=sys.stderr)
                return None
            line = line_bytes.decode('utf-8').strip()
            print(f"Stderr: {line}")

            match = re.search(r'DevTools listening on (ws://.+)', line)
            if match:
                browser_ws_url = match.group(1)
                print(f"Found browser WebSocket URL: {browser_ws_url}")
                break # Exit loop once browser URL is found
        except Exception as e:
            print(f"Error reading stderr for browser URL: {e}", file=sys.stderr)
            return None

    if not browser_ws_url:
        return None

    # Extract http base URL from ws URL (e.g., ws://127.0.0.1:32123/...) -> http://127.0.0.1:32123
    http_base_url = browser_ws_url.replace('ws://', 'http://').split('/devtools/')[0]
    list_url = f"{http_base_url}/json/list"

    print(f"Querying target list: {list_url}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(list_url) as response:
                if response.status != 200:
                    print(f"Error fetching target list: Status {response.status}", file=sys.stderr)
                    return None
                targets = await response.json()
                # print(f"Targets: {json.dumps(targets, indent=2)}") # Debug: print targets

                # Find the first target of type 'page' that has a webSocketDebuggerUrl
                for target in targets:
                    if target.get('type') == 'page' and 'webSocketDebuggerUrl' in target:
                        page_ws_url = target['webSocketDebuggerUrl']
                        print(f"Found page WebSocket URL: {page_ws_url}")
                        return page_ws_url

                print("No suitable page target found in the list.", file=sys.stderr)
                return None
    except aiohttp.ClientConnectorError as e:
         print(f"Connection error fetching target list: {e}", file=sys.stderr)
         return None
    except Exception as e:
        print(f"Error fetching/parsing target list: {e}", file=sys.stderr)
        return None


async def send_cdp_command(ws, method, params={}):
    """Sends a command over the CDP WebSocket connection and returns its ID."""
    global command_id_counter
    command_id = command_id_counter
    command_id_counter += 1

    command = {
        "id": command_id,
        "method": method,
        "params": params
    }
    print(f"Sending command (ID: {command_id}): {method} {params if params else ''}")
    await ws.send(json.dumps(command))
    # Store a future that will resolve with the command's result
    future = asyncio.get_event_loop().create_future()
    pending_commands[command_id] = future
    return command_id, future

async def handle_request_intercepted(ws, params):
    """Handles the Network.requestIntercepted event."""
    interception_id = params['interceptionId']
    request_url = params['request']['url']
    resource_type = params.get('resourceType', 'Unknown') # Get resource type

    print(f"Intercepted {resource_type}: {request_url}")

    # Only modify the target script
    if resource_type == 'Script:' and INTERCEPT_PATTERN in request_url:
        print(f"Modifying script: {request_url}")
        try:
            # Get original body
            cmd_id, future = await send_cdp_command(ws, "Network.getResponseBodyForInterception", {"interceptionId": interception_id})
            response = await asyncio.wait_for(future, timeout=10) # Wait for the response

            if response.get('error'):
                 print(f"Error getting response body: {response['error']['message']}", file=sys.stderr)
                 # Continue without modification on error
                 await send_cdp_command(ws, "Network.continueInterceptedRequest", {"interceptionId": interception_id})
                 return

            original_body_b64 = response['result']['body']
            is_base64_encoded = response['result']['base64Encoded']

            if is_base64_encoded:
                original_body_bytes = base64.b64decode(original_body_b64)
            else:
                # Assume UTF-8 if not base64 encoded, though script bodies usually are
                original_body_bytes = original_body_b64.encode('utf-8')

            # Prepend the test message (ensure it's bytes)
            modified_body_bytes = TEST_MESSAGE.encode('utf-8') + b'\n' + original_body_bytes
            print(f"Added test message to script.")

            # Construct new raw response (HTTP headers + body)
            # Note: Constructing raw HTTP responses manually can be tricky.
            # This is a simplified example. Real-world scenarios might need more robust header handling.
            headers = [
                "HTTP/1.1 200 OK",
                "Content-Type: application/javascript; charset=utf-8",
                f"Content-Length: {len(modified_body_bytes)}",
                # Add other necessary headers if needed, e.g., CORS
                "Connection: closed" # Important for raw response
            ]
            raw_response_headers = "\r\n".join(headers) + "\r\n\r\n"
            raw_response_bytes = raw_response_headers.encode('utf-8') + modified_body_bytes

            # Encode the entire raw response (headers + body) in base64
            new_response_b64 = base64.b64encode(raw_response_bytes).decode('utf-8')

            # Continue request with modified body
            await send_cdp_command(
                ws,
                "Network.continueInterceptedRequest",
                {
                    "interceptionId": interception_id,
                    "rawResponse": new_response_b64
                }
            )
            print(f"Sent modified script back to browser.")

        except asyncio.TimeoutError:
            print(f"Timeout waiting for response body for {interception_id}", file=sys.stderr)
            # Attempt to continue without modification on timeout
            await send_cdp_command(ws, "Network.continueInterceptedRequest", {"interceptionId": interception_id})
        except Exception as e:
            print(f"Error handling intercepted request {interception_id}: {e}", file=sys.stderr)
            # Attempt to continue without modification on other errors
            try:
                await send_cdp_command(ws, "Network.continueInterceptedRequest", {"interceptionId": interception_id})
            except Exception as continue_e:
                 print(f"Failed to continue request {interception_id} after error: {continue_e}", file=sys.stderr)
    else:
        # Continue other requests without modification
        await send_cdp_command(ws, "Network.continueInterceptedRequest", {"interceptionId": interception_id})


async def listen_for_events(ws):
    """Listens for incoming WebSocket messages and handles them."""
    try:
        async for message in ws:
            # print(f"Raw message received: {message[:200]}...") # Debug: print raw message
            try:
                data = json.loads(message)
                # Check if it's a response to a command
                if 'id' in data:
                    command_id = data['id']
                    if command_id in pending_commands:
                        future = pending_commands.pop(command_id)
                        if 'error' in data:
                            print(f"Command {command_id} error: {data['error']['message']}")
                            future.set_exception(Exception(data['error']['message']))
                        else:
                            # print(f"Received response for command {command_id}: {data.get('result', {})}")
                            future.set_result(data) # Resolve the future with the full response
                    else:
                        print(f"Received response for unknown command ID: {command_id}")
                # Check if it's an event
                elif 'method' in data:
                    # print(f"Received event: {data['method']}") # Debug: print event name
                    if data['method'] == 'Network.requestIntercepted':
                        # Don't await here, let it run concurrently
                        asyncio.create_task(handle_request_intercepted(ws, data['params']))
                    elif data['method'] == 'Runtime.consoleAPICalled':
                        # Optionally print console messages from the game
                        log_args = [arg.get('value', str(arg.get('unserializableValue', ''))) for arg in data['params']['args']]
                        print(f"Game Console ({data['params']['type']}): {' '.join(map(str, log_args))}")
                    # Handle other events if needed
                else:
                    print(f"Received unknown message format: {data}")

            except json.JSONDecodeError:
                print(f"Failed to decode JSON message: {message[:200]}...")
            except Exception as e:
                print(f"Error processing message: {e}\nMessage: {message[:200]}...")

    except websockets.exceptions.ConnectionClosedOK:
        print("WebSocket connection closed normally.")
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"WebSocket connection closed with error: {e}")
    except Exception as e:
        print(f"Error in event listener: {e}")
    finally:
        print("Event listener stopped.")


async def main():
    process = None # Initialize process to None
    ws_connection = None # Keep track of the WebSocket connection
    main_task = None
    listener_task = None

    try:
        print(f"Starting {GAME_EXECUTABLE} with remote debugging on port {CDP_PORT}...")
        # Start the game process
        # Use shell=True ONLY if GAME_EXECUTABLE might contain spaces or needs shell interpretation
        # Be cautious with shell=True due to security implications if the path is user-controlled.
        # If the path is fixed and known, avoid shell=True.
        process = await asyncio.create_subprocess_exec(
            GAME_EXECUTABLE,
            f'--remote-debugging-port={CDP_PORT}',
            stderr=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE # Capture stdout too if needed
            # Consider adding creationflags for Windows if needed, e.g., subprocess.CREATE_NO_WINDOW
        )
        print(f"Game process started (PID: {process.pid}).")

        # Start a task to monitor the process completion
        process_monitor_task = asyncio.create_task(process.wait())

        # Find the page WebSocket URL - run concurrently with process monitoring
        find_url_task = asyncio.create_task(find_page_websocket_url(process))

        # Wait for either the process to exit or the page URL to be found
        done, pending = await asyncio.wait(
            [process_monitor_task, find_url_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        if process_monitor_task in done:
            print(f"Game process exited prematurely with code {process.returncode} before URL was found.", file=sys.stderr)
            find_url_task.cancel() # Cancel the URL finding task
            return

        # If find_url_task completed first
        websocket_url = find_url_task.result()
        if not websocket_url:
            print("Could not find WebSocket URL. Exiting.", file=sys.stderr)
            process_monitor_task.cancel() # Cancel the process monitor
            if process.returncode is None: process.terminate()
            return

        # URL found, connect to WebSocket
        # Removed read_limit and write_limit as they caused TypeError in user's environment
        async with websockets.connect(websocket_url, max_size=None) as ws: # Increase max_size for potentially large scripts
            ws_connection = ws # Store connection for cleanup
            print("Connected to DevTools WebSocket.")

            # Start listening for events in the background
            listener_task = asyncio.create_task(listen_for_events(ws))

            # Enable necessary domains
            await send_cdp_command(ws, "Page.enable")
            await send_cdp_command(ws, "Network.enable")
            await send_cdp_command(ws, "Runtime.enable") # Enable Runtime for console logs and evaluation

            # Bypass Content Security Policy
            await send_cdp_command(ws, "Page.setBypassCSP", {"enabled": True})
            print("Bypassed CSP.")

            # Set up request interception
            await send_cdp_command(
                ws,
                "Network.setRequestInterception",
                {"patterns": [{"urlPattern": INTERCEPT_PATTERN, "resourceType": "Script", "interceptionStage": "HeadersReceived"}]}
            )
            print(f"Set up interception for pattern: {INTERCEPT_PATTERN}")

            print("Injector setup complete. Running indefinitely. Press Ctrl+C to exit.")
            # Keep the main task running until the listener or process monitor finishes, or Ctrl+C
            # Wait for the process monitor task OR the listener task to complete
            done, pending = await asyncio.wait(
                 [process_monitor_task, listener_task],
                 return_when=asyncio.FIRST_COMPLETED
            )
            print("A task finished, initiating shutdown...")


    except FileNotFoundError:
        print(f"Error: '{GAME_EXECUTABLE}' not found. Make sure it's in the correct path.", file=sys.stderr)
    except ConnectionRefusedError:
        print(f"Error: Connection refused. Is another debugger already attached or is the port ({CDP_PORT}) wrong?", file=sys.stderr)
    except websockets.exceptions.InvalidURI:
         print(f"Error: Invalid WebSocket URI generated. Check stderr output.", file=sys.stderr)
    except asyncio.CancelledError:
         print("Main task cancelled.")
    except Exception as e:
        print(f"An unexpected error occurred in main: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        print("Cleaning up...")
        # Cancel listener task if running
        if listener_task and not listener_task.done():
            listener_task.cancel()
            try:
                await listener_task # Allow listener cleanup
            except asyncio.CancelledError:
                pass # Expected
        # Close WebSocket if open and connection object exists
        # Explicitly check the type before accessing .closed or calling .close()
        if isinstance(ws_connection, websockets.WebSocketClientProtocol):
            if not ws_connection.closed:
                try:
                    await ws_connection.close()
                    print("WebSocket connection closed.")
                except Exception as ws_close_e:
                    print(f"Error closing WebSocket: {ws_close_e}", file=sys.stderr)
            else:
                print("WebSocket connection already closed.")
        elif ws_connection is not None:
            # Log if it's not the expected type, but don't try to close it via websockets API
            print(f"Warning: ws_connection is of unexpected type {type(ws_connection)} during cleanup, cannot close.", file=sys.stderr)

        # Terminate game process if running
        if process and process.returncode is None:
            print("Terminating game process...")
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5.0) # Wait with timeout
                print("Game process terminated.")
            except asyncio.TimeoutError:
                print("Game process did not terminate gracefully, killing.")
                process.kill()
                await process.wait()
            except Exception as term_e:
                 print(f"Error during process termination: {term_e}")
        elif process:
            print(f"Game process already exited with code: {process.returncode}")
        print("Cleanup finished.")


if __name__ == "__main__":
    # Use asyncio.run for cleaner startup and shutdown
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user. Exiting.")
    except Exception as e:
        print(f"Unhandled exception in main execution: {e}", file=sys.stderr)
