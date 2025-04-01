import os
import json
import requests
from dotenv import load_dotenv
from datetime import datetime
import re
import random
import time
import traceback

load_dotenv()

# TogetherAI API configuration
TOGETHER_API_KEY = os.getenv('TOGETHER_API_KEY')
API_URL = "https://api.together.xyz/inference"
model_name = "mistralai/Mixtral-8x7B-Instruct-v0.1"  # Default model

headers = {
    "Authorization": f"Bearer {TOGETHER_API_KEY}",
    "Content-Type": "application/json"
}

def enhance_roadmap_diversity(roadmap_data):
    """Post-process the roadmap to ensure diversity in phases and tasks"""
    try:
        # Return content-based roadmap data as is
        if isinstance(roadmap_data, dict) and 'content' in roadmap_data:
            # No need to modify content-based roadmaps
            return roadmap_data
            
        # Handle old-format roadmaps with phases
        if not roadmap_data or not isinstance(roadmap_data, dict) or 'phases' not in roadmap_data:
            print("Invalid roadmap data structure, returning as is")
            return roadmap_data
            
        phases = roadmap_data['phases']
        if not isinstance(phases, list) or len(phases) == 0:
            print("Invalid phases data structure, returning as is")
            return roadmap_data
            
        # Ensure we don't always have exactly 3 phases
        phase_count = len(phases)
        if phase_count == 3:
            # Randomly split a phase or merge phases based on content
            rand_val = random.random()
            if rand_val > 0.5 and len(phases) > 0:
                # Split a phase
                phase_to_split = random.choice(phases)
                if 'tasks' in phase_to_split and isinstance(phase_to_split['tasks'], list) and len(phase_to_split['tasks']) > 2:
                    # Create two phases from one
                    tasks = phase_to_split['tasks']
                    split_point = len(tasks) // 2
                    
                    first_half = tasks[:split_point]
                    second_half = tasks[split_point:]
                    
                    # Create a new phase with the second half of tasks
                    new_phase = {
                        'name': f"Sub-{phase_to_split['name']}",
                        'description': f"Extension of {phase_to_split['name']} tasks",
                        'tasks': second_half
                    }
                    
                    # Update the original phase with just the first half
                    phase_to_split['tasks'] = first_half
                    
                    # Add the new phase after the original one
                    phase_index = phases.index(phase_to_split)
                    if phase_index < len(phases):
                        phases.insert(phase_index + 1, new_phase)
                    else:
                        phases.append(new_phase)
        
        # Ensure task diversity: Check for repeated words in task titles
        common_prefixes = ['Create', 'Develop', 'Implement', 'Design', 'Set up', 'Configure']
        task_titles = []
        
        for phase in phases:
            if 'tasks' in phase and isinstance(phase['tasks'], list):
                for task in phase['tasks']:
                    if 'title' in task:
                        task_titles.append(task['title'])
        
        # Count how many times each prefix appears
        prefix_counts = {}
        for prefix in common_prefixes:
            prefix_counts[prefix] = sum(1 for title in task_titles if title.startswith(prefix))
        
        # If any prefix is used too many times, replace some instances
        for prefix, count in prefix_counts.items():
            if count > 2:  # If a prefix is used more than twice
                replacements = ['Build', 'Construct', 'Establish', 'Generate', 'Prepare', 'Create', 'Setup']
                replacements.remove(prefix) if prefix in replacements else None
                
                tasks_to_change = count - 2  # Keep 2 instances, change the rest
                tasks_changed = 0
                
                for phase in phases:
                    if tasks_changed >= tasks_to_change:
                        break
                        
                    if 'tasks' in phase and isinstance(phase['tasks'], list):
                        for task in phase['tasks']:
                            if tasks_changed >= tasks_to_change:
                                break
                                
                            if 'title' in task and task['title'].startswith(prefix):
                                # Replace the prefix with a random alternative
                                replacement = random.choice(replacements)
                                task['title'] = task['title'].replace(prefix, replacement, 1)
                                tasks_changed += 1
        
        return roadmap_data
    except Exception as e:
        print(f"Error enhancing roadmap diversity: {e}")
        # Return the original data if there's an error
        return roadmap_data

def generate_roadmap_with_custom_prompt(custom_prompt):
    """
    Generate a roadmap using a fully defined, custom prompt.
    This function will use the exact custom prompt provided without adding any default templates.
    """
    if not custom_prompt:
        print("Error: Empty prompt provided to generate_roadmap_with_custom_prompt")
        return None
        
    try:
        print(f"Generating roadmap with custom prompt of length: {len(custom_prompt)}")
        
        # Configure model parameters with some controlled randomization for more diverse outputs
        # but with limits to ensure output quality and consistency
        temperature = min(0.7, 0.5 + random.random() * 0.2)  # Between 0.5 and 0.7
        top_p = min(0.8, 0.7 + random.random() * 0.1)        # Between 0.7 and 0.8
        top_k = random.randint(40, 50)                       # Randomize token selection
        
        # Add AI instruction to prevent output caching, but preserve the prompt structure
        anti_caching = f"\n\nNote: Generate a completely unique response for this specific request (request ID: {int(time.time())})."
        full_prompt = custom_prompt + anti_caching
        
        print(f"Using model parameters: temperature={temperature}, top_p={top_p}, top_k={top_k}")
        
        # Ensure the TOGETHER_API_KEY is available
        if not TOGETHER_API_KEY:
            print("Error: TOGETHER_API_KEY environment variable is not set")
            return {
                "content": "API Configuration Error: The TOGETHER_API_KEY environment variable is not set. Please configure the API key."
            }
            
        # Make the API call to Together AI
        try:
            response = requests.post(
                API_URL,
                headers=headers,
                json={
                    "model": model_name,
                    "prompt": full_prompt,
                    "max_tokens": 2048,
                    "temperature": temperature,
                    "top_p": top_p,
                    "top_k": top_k,
                    "repetition_penalty": 1.1
                },
                timeout=60
            )
            
            print(f"API Response status code: {response.status_code}")
            
            # Extract the output text
            if response.status_code == 200:
                result = response.json()
                try:
                    output_text = extract_text_from_api_response(result)
                    print(f"AI response received. Length: {len(output_text)}")
                    
                    # Extract roadmap content using regex to find the [Roadmap] section
                    roadmap_pattern = r'\[Roadmap\](.*?)(?:$|\[|<end>)'
                    roadmap_match = re.search(roadmap_pattern, output_text, re.DOTALL)
                    
                    if roadmap_match:
                        roadmap_content = roadmap_match.group(1).strip()
                        print(f"Extracted roadmap content. Length: {len(roadmap_content)}")
                    else:
                        # If no specific [Roadmap] section is found, use the entire response
                        roadmap_content = output_text
                        print("No [Roadmap] section found, using full response")
                    
                    # Return the content in a standardized dictionary format
                    return {
                        "content": roadmap_content
                    }
                except (KeyError, IndexError, TypeError) as e:
                    print(f"Error extracting roadmap content from API response: {e}")
                    print(f"API response structure: {result}")
                    return {
                        "content": f"Error processing AI response: {str(e)}"
                    }
            else:
                error_msg = f"API request failed with status {response.status_code}"
                try:
                    error_details = response.json()
                    print(f"Error details: {error_details}")
                except:
                    error_details = {"error": "Could not parse error response"}
                
                print(error_msg)
                return {
                    "content": f"API Error: {response.status_code}. The AI service returned an error: {error_msg}. Please try again."
                }
        except requests.RequestException as e:
            print(f"API request error: {str(e)}")
            return {
                "content": f"API Request Error: Failed to communicate with the AI service: {str(e)}. Please check your network connection and try again."
            }
    except Exception as e:
        print(f"Error generating roadmap with custom prompt: {str(e)}")
        traceback.print_exc()
        # Print more details about the error to help debug
        print(f"Error type: {type(e).__name__}")
        print(f"Error args: {e.args}")
        
        return {
            "content": f"Error in Roadmap Generation: An error occurred while generating the roadmap: {str(e)}. Please try again with different inputs."
        }

def generate_roadmap(requirements):
    """Generate a project roadmap using Together AI"""
    # Add timestamp and random seed to prevent caching
    timestamp = int(time.time())
    random_seed = random.randint(1000, 9999)
    
    # Extract key information from the requirements
    project_title = ""
    description = ""
    deadline_info = ""
    priority_info = ""
    problem_statement = ""
    
    # Extract details from the requirements
    for line in requirements.split('\n'):
        line = line.strip()
        if line:
            if re.search(r'project title|title', line.lower()):
                # Extract the part after the colon if it exists
                parts = line.split(':', 1)
                project_title = parts[1].strip() if len(parts) > 1 else line
            elif re.search(r'description', line.lower()):
                parts = line.split(':', 1)
                description = parts[1].strip() if len(parts) > 1 else ""
            elif re.search(r'deadline', line.lower()):
                deadline_info = line
            elif re.search(r'priority', line.lower()):
                priority_info = line
            elif re.search(r'requirements|goals|problem statement', line.lower()):
                parts = line.split(':', 1)
                problem_statement = parts[1].strip() if len(parts) > 1 else ""
    
    # Calculate days remaining if deadline is present
    days_remaining = None
    tight_deadline = False
    if deadline_info:
        try:
            # Extract date from deadline info
            date_match = re.search(r'\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|\d{2}-\d{2}-\d{4}', deadline_info)
            if date_match:
                date_str = date_match.group(0)
                
                # Try different date formats
                formats = ['%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y']
                for fmt in formats:
                    try:
                        deadline_date = datetime.strptime(date_str, fmt)
                        current_date = datetime.now()
                        delta = deadline_date - current_date
                        days_remaining = max(0, delta.days)
                        # Determine if deadline is tight (less than 30 days)
                        tight_deadline = days_remaining < 30
                        break
                    except ValueError:
                        continue
        except Exception as e:
            print(f"Error parsing deadline: {e}")
    
    # Clean up project title if needed (remove "Project Title:" prefix)
    if project_title and ':' in project_title:
        project_title = project_title.split(':', 1)[1].strip()
    
    # Analyze project complexity based on description and problem statement
    project_complexity = "medium"  # Default
    complexity_factors = []
    
    complexity_keywords = {
        "high": ["complex", "advanced", "sophisticated", "extensive", "comprehensive", "enterprise", 
                "microservices", "distributed", "real-time", "AI", "ML", "machine learning",
                "blockchain", "scalable", "high-performance", "multi-tenant", "big data"],
        "medium": ["moderate", "standard", "typical", "conventional", "regular", "normal",
                  "API", "integration", "dashboard", "authentication", "authorization"],
        "low": ["simple", "basic", "minimal", "straightforward", "easy", "small", "prototype",
               "MVP", "proof of concept", "PoC", "single-page", "static"]
    }
    
    combined_text = (description + " " + problem_statement).lower()
    
    # Count complexity indicators
    high_count = sum(1 for word in complexity_keywords["high"] if word.lower() in combined_text)
    medium_count = sum(1 for word in complexity_keywords["medium"] if word.lower() in combined_text)
    low_count = sum(1 for word in complexity_keywords["low"] if word.lower() in combined_text)
    
    # Determine complexity based on keyword counts
    if high_count > (medium_count + low_count):
        project_complexity = "high"
        complexity_factors = [word for word in complexity_keywords["high"] 
                             if word.lower() in combined_text][:3]  # Top 3 factors
    elif low_count > (high_count + medium_count):
        project_complexity = "low"
        complexity_factors = [word for word in complexity_keywords["low"] 
                             if word.lower() in combined_text][:3]
    else:
        project_complexity = "medium"
        complexity_factors = [word for word in complexity_keywords["medium"] 
                             if word.lower() in combined_text][:3]
                             
    # Determine project development methodology based on description and timeline
    methodology = "Agile"  # Default
    if tight_deadline:
        methodology = "Agile with Sprint cycles"
    elif "waterfall" in combined_text.lower():
        methodology = "Waterfall"
    elif "devops" in combined_text.lower() or "ci/cd" in combined_text.lower():
        methodology = "DevOps with CI/CD"
    elif "microservices" in combined_text.lower():
        methodology = "Microservices Architecture"
    elif "machine learning" in combined_text.lower() or "ai" in combined_text.lower():
        methodology = "AI/ML Development Pipeline"
    
    # Build an intelligent, context-aware prompt
    context_prompt = f"Create a detailed software development roadmap for '{project_title}'."
    
    # Add description if available
    if description:
        context_prompt += f" The goal is to {description.strip('.')}."
    
    # Add problem statement if available
    if problem_statement:
        context_prompt += f" The key challenge to solve is: {problem_statement.strip('.')}."
    
    # Add deadline information and timeline guidance
    if days_remaining is not None:
        if tight_deadline:
            context_prompt += f" CRITICAL: There are only {days_remaining} days to complete this project, which is a tight deadline. The roadmap must be streamlined and prioritize critical development tasks."
        else:
            context_prompt += f" The project timeline allows {days_remaining} days for completion."
    elif deadline_info:
        # Just use the raw deadline info if we couldn't parse it
        deadline_part = deadline_info.split(':', 1)[1].strip() if ':' in deadline_info else deadline_info
        context_prompt += f" The deadline is {deadline_part}."
    
    # Add complexity information
    context_prompt += f" This is a {project_complexity} complexity software project" + (f" with {', '.join(complexity_factors)}" if complexity_factors else "") + "."
    
    # Add specific guidance for methodology
    context_prompt += f" Implement a {methodology} approach for this software development project."
    
    # Full prompt with guidelines for software development focus
    prompt = f"""{context_prompt}

Requirements and Context:
{requirements}

Software Development Requirements:
1. Generate a STRICTLY SOFTWARE DEVELOPMENT-FOCUSED roadmap, not a generic project plan
2. The number of phases and tasks must be dynamically determined based on project complexity:
   - Low complexity: 3-4 phases with 2-3 tasks each
   - Medium complexity: 4-5 phases with 3-4 tasks each
   - High complexity: 5-7 phases with 4-6 tasks each
3. For tight deadlines (under 30 days), prioritize essential development tasks and create a fast-tracked plan

4. Structure phases according to standard software development lifecycle:
   - Include initial phases for planning, requirements gathering, and design
   - Include middle phases for development, testing, and integration
   - Include final phases for deployment, documentation, and maintenance
   
5. MUST incorporate industry best practices relevant to the project:
   - For {methodology} projects, include specific methodology elements
   - Include necessary testing stages (unit, integration, system, user acceptance)
   - Include DevOps practices where relevant (CI/CD, infrastructure as code)
   - For AI/ML projects, include data processing and model training steps

6. Provide realistic time estimates for each task that:
   - Account for the project's total available time of {days_remaining if days_remaining is not None else 'unknown'} days
   - Allocate time proportionally based on task complexity and importance
   - Include buffer time for unexpected issues and revisions
   
7. Ensure each task is:
   - Specific to software development (NO generic market research, presentations, etc.)
   - Actionable and measurable
   - Technical in nature with clear deliverables
   - Described with software development terminology and concepts

8. IMPORTANT: This is a unique request (timestamp: {timestamp}, seed: {random_seed}). Do not provide a generic or templated roadmap. Create a completely fresh and unique roadmap specific to this project's needs.

The roadmap MUST be uniquely tailored to this specific software project, not a generic template.

Please provide the response in the following JSON format:
{
    "phases": [
        {
            "name": "Phase name - must be specific to software development",
            "description": "Phase description with methodology and technical details",
            "tasks": [
                {
                    "title": "Technical task title",
                    "description": "Detailed technical description",
                    "estimated_duration": "X days"
                }
            ]
        }
    ]
}"""

    print(f"Generated prompt: {context_prompt}")

    try:
        # Add more randomization to model parameters
        temperature = min(0.7, 0.5 + random.random() * 0.2)  # Between 0.5 and 0.7
        top_p = min(0.8, 0.7 + random.random() * 0.1)        # Between 0.7 and 0.8
        top_k = random.randint(40, 50)                       # Randomize token selection
        
        if not TOGETHER_API_KEY:
            print("Error: TOGETHER_API_KEY environment variable is not set")
            return {
                "content": "API Configuration Error: The TOGETHER_API_KEY environment variable is not set. Please configure the API key."
            }
            
        response = requests.post(
            API_URL,
            headers=headers,
            json={
                "model": model_name,
                "prompt": prompt,
                "max_tokens": 1500,
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
                "request_timeout": 120,  # Longer timeout for complex requests
                "repetition_penalty": 1.2  # Discourage repetitive patterns
            },
            timeout=60  # Request timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            try:
                output_text = extract_text_from_api_response(result)
                return {
                    "content": output_text
                }
            except (KeyError, IndexError, TypeError) as e:
                print(f"Error extracting text from API response: {e}")
                print(f"API response structure: {result}")
                return {
                    "content": f"Error processing AI response: {str(e)}"
                }
        else:
            error_msg = f"API request failed with status {response.status_code}"
            print(error_msg)
            return {
                "content": f"API Error: {response.status_code}. The AI service returned an error. Please try again."
            }
    except Exception as e:
        print(f"Error generating roadmap: {e}")
        return {
            "content": f"Error in Roadmap Generation: An error occurred while generating the roadmap: {str(e)}. Please try again with different inputs."
        }

def generate_progress_report(project_data, tasks_data):
    """Generate a progress report using Together AI"""
    prompt = f"""Based on the following project and tasks data, generate a comprehensive progress report:

Project:
{json.dumps(project_data, indent=2)}

Tasks:
{json.dumps(tasks_data, indent=2)}

Please provide a detailed report covering:
1. Overall project progress
2. Key achievements
3. Current status of tasks
4. Recommendations
"""

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json={
                "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
                "prompt": prompt,
                "max_tokens": 1000,
                "temperature": 0.7
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            try:
                # Try the new API response structure first
                if 'choices' in result:
                    return result['choices'][0]['text']
                # Fall back to the old structure if needed
                elif 'output' in result and 'choices' in result['output']:
                    return result['output']['choices'][0]['text']
                else:
                    # If we can't find the expected structure, extract any text field we can find
                    print("Unexpected API response structure:", result)
                    # Check if there's any text field at the top level
                    if 'text' in result:
                        return result['text']
                    # Try to find a text field in any nested structure
                    elif any('text' in item for item in result.values() if isinstance(item, dict)):
                        for value in result.values():
                            if isinstance(value, dict) and 'text' in value:
                                return value['text']
                    # Last resort: convert the entire result to string
                    raise ValueError(f"Could not find text field in API response: {result}")
            except (KeyError, IndexError, TypeError) as e:
                print(f"Error extracting text from API response: {e}")
                print(f"API response structure: {result}")
                return f"Error processing AI response: {str(e)}"
        else:
            raise Exception(f"API request failed with status {response.status_code}")
    except Exception as e:
        print(f"Error generating progress report: {e}")
        return None

def extract_text_from_api_response(result):
    """Helper function to extract text from API response, handling different formats"""
    try:
        # Try the new API response structure first
        if 'choices' in result:
            return result['choices'][0]['text']
        # Fall back to the old structure if needed
        elif 'output' in result and 'choices' in result['output']:
            return result['output']['choices'][0]['text']
        else:
            # If we can't find the expected structure, extract any text field we can find
            print("Unexpected API response structure:", result)
            # Check if there's any text field at the top level
            if 'text' in result:
                return result['text']
            # Try to find a text field in any nested structure
            elif any('text' in item for item in result.values() if isinstance(item, dict)):
                for value in result.values():
                    if isinstance(value, dict) and 'text' in value:
                        return value['text']
            # Last resort: convert the entire result to string
            raise ValueError(f"Could not find text field in API response: {result}")
    except (KeyError, IndexError, TypeError) as e:
        print(f"Error extracting text from API response: {e}")
        print(f"API response structure: {result}")
        return f"Error processing AI response: {str(e)}" 