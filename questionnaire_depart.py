import json
from openai import OpenAI

client = OpenAI()


# 1. Simulated tools



# 2. Payload shell

payload = {
    "model": "gpt-6-luna",
    "instructions": "", # system messages
    "input": [], # user messages
    "tools": [],
    "parallel_tool_calls": True,
}


# 3. Reusable payload builders

def addMessage(message):
    payload["input"].append({
        "role": "user",
        "content": message,
    })

tools=[{"type":"web_search"}]


tools=[
    {
        "type":"file_search",
        "vector_store_ids": ["vs_6ac4ea173ffc8191843ce18096b6c749"]
    }]


def add_mcp (server_label, server_url):
    payload["tools"].append({
        "type":"mcp",
        "server_label":server_label,
        "server_url": server_url,
        "require_approval": "never",
    })

def addInstruction(instruction):
    payload["instructions"] += instruction + "\n"


def addTool(name, description, parameters):
    payload["tools"].append({
        "type": "function",
        "name": name,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": {
                parameter["name"]: {
                    "type": parameter["type"],
                    "description": parameter["description"],
                }
                for parameter in parameters
            },
            "required": [parameter["name"] for parameter in parameters],
            "additionalProperties": False,
        },
        "strict": True,
    })



def callGenAIAPI(payload):
    return client.responses.create(**payload)


# 4. Add instructions and the user message

addInstruction("""
You troubleshoot simulated routers.

For each requested router:
1. Check its status.
2. If online, no further action is needed.
3. If offline, restart it once, then check its status again.
4. If still offline, create one support ticket.

Complete the process for each router.
Use only tool results to describe what happened.
Finish with a short summary for each router, including any ticket ID.
""")

addMessage("Please investigate routers R1 and R2. Both seem offline.")


# 5. Add tools: tool names must match the Python function names

addTool(
    name="check_router",
    description="Check whether a router is online or offline.",
    parameters=[
        {
            "name": "routerId",
            "type": "string",
            "description": "Router identifier: R1 or R2.",
        },
    ],
)

addTool(
    name="restart_router",
    description="Restart a router. Check its status afterwards.",
    parameters=[
        {
            "name": "routerId",
            "type": "string",
            "description": "Router identifier: R1 or R2.",
        },
    ],
)

addTool(
    name="create_ticket",
    description="Create a support ticket for a router that remains offline.",
    parameters=[
        {
            "name": "routerId",
            "type": "string",
            "description": "Router identifier: R1 or R2.",
        },
        {
            "name": "summary",
            "type": "string",
            "description": "The issue and troubleshooting steps performed.",
        },
    ],
)


# 6. Execute the tool-calling loop

print("Starting router troubleshooting...\n")

for _ in range(1000):
    response = callGenAIAPI(payload)

    # Keep the complete model response in the conversation.
    payload["input"].extend(response.output)

    tool_calls = [
        item for item in response.output
        if item.type == "function_call"
    ]

    if not tool_calls:
        print(f"\nFinal answer:\n{response.output_text}")
        break

    for tool_call in tool_calls:
        arguments = json.loads(tool_call.arguments)

        # Find the Python function by name and execute it.
        result = globals()[tool_call.name](**arguments)

        # Return the result to the model.
        payload["input"].append({
            "type": "function_call_output",
            "call_id": tool_call.call_id,
            "output": json.dumps(result),
        })
else:
    print("Stopped: maximum number of API rounds reached.")