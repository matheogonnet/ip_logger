import os
import customtkinter as ctk
import sqlite3
from termcolor import colored
import folium
import webbrowser
from PIL import Image
import json
import requests

# Constants
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server", "database"))
DB_PATH = os.path.abspath(os.path.join(DB_DIR, "iplogger.db"))
print(colored(f"Using database at: {DB_PATH}", "blue"))
SERVER_URL = os.getenv("IPLOGGER_SERVER_URL", "https://ip-logger-kpo8.onrender.com")
MAP_PATH = "temp_map.html"
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800

class IPLoggerApp:
    def __init__(self):
        try:
            # Initialize main window
            self.setup_window()
            # Initialize database
            self.setup_database()
            # Create UI elements
            self.create_ui()
            print(colored("Application initialized successfully", "green"))
        except Exception as e:
            print(colored(f"Error initializing application: {str(e)}", "red"))
            raise

    def setup_window(self):
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("green")
        
        self.root = ctk.CTk()
        self.root.title("IP Logger Pro")
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")

    def setup_database(self):
        try:
            # Ensure database directory exists
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            print(colored("Database directory checked/created", "green"))
            
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS tracked_ips (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ip TEXT NOT NULL,
                        country TEXT,
                        city TEXT,
                        latitude REAL,
                        longitude REAL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                conn.commit()
            print(colored("Database initialized successfully", "green"))
        except Exception as e:
            print(colored(f"Database initialization error: {str(e)}", "red"))
            raise

    def create_ui(self):
        try:
            # Create main frame
            self.main_frame = ctk.CTkFrame(self.root)
            self.main_frame.pack(fill="both", expand=True, padx=20, pady=20)

            # URL Input section
            self.url_frame = ctk.CTkFrame(self.main_frame)
            self.url_frame.pack(fill="x", padx=10, pady=10)

            self.url_label = ctk.CTkLabel(self.url_frame, text="YouTube URL:")
            self.url_label.pack(side="left", padx=5)

            self.url_entry = ctk.CTkEntry(self.url_frame, width=400)
            self.url_entry.pack(side="left", padx=5)

            self.generate_button = ctk.CTkButton(
                self.url_frame, 
                text="Generate Link", 
                command=self.generate_tracking_link
            )
            self.generate_button.pack(side="left", padx=5)

            # Generated Link section
            self.link_frame = ctk.CTkFrame(self.main_frame)
            self.link_frame.pack(fill="x", padx=10, pady=10)

            self.generated_link = ctk.CTkEntry(self.link_frame, width=500)
            self.generated_link.pack(side="left", padx=5)

            self.copy_button = ctk.CTkButton(
                self.link_frame, 
                text="Copy Link", 
                command=self.copy_link
            )
            self.copy_button.pack(side="left", padx=5)

            # Create history view first
            self.create_history_view()
            
            # Then create map view
            self.create_map_view()

            print(colored("UI created successfully", "green"))
        except Exception as e:
            print(colored(f"Error creating UI: {str(e)}", "red"))

    def create_map_view(self):
        try:
            self.map_frame = ctk.CTkFrame(self.main_frame)
            self.map_frame.pack(fill="both", expand=True, padx=10, pady=10)
            
            # Add refresh button
            self.refresh_button = ctk.CTkButton(
                self.map_frame,
                text="Refresh Data",
                command=self.refresh_data
            )
            self.refresh_button.pack(pady=5)
            
            # Add view map button
            self.view_map_button = ctk.CTkButton(
                self.map_frame,
                text="View Map",
                command=self.open_map
            )
            self.view_map_button.pack(pady=5)
            
            # Initial map update
            self.update_map()
            
            # Set up auto-refresh every 30 seconds
            self.setup_auto_refresh()
            
        except Exception as e:
            print(colored(f"Error creating map view: {str(e)}", "red"))

    def setup_auto_refresh(self):
        try:
            self.refresh_data()
            self.root.after(30000, self.setup_auto_refresh)  # 30 seconds
        except Exception as e:
            print(colored(f"Error in auto refresh: {str(e)}", "red"))

    def refresh_data(self):
        try:
            self.check_database()
            self.update_map()
            self.update_history()
            print(colored("Data refreshed successfully", "green"))
        except Exception as e:
            print(colored(f"Error refreshing data: {str(e)}", "red"))

    def update_history(self):
        try:
            self.history_text.delete("1.0", "end")
            response = requests.get(f"{SERVER_URL}/api/tracked-ips")
            if response.status_code == 200:
                data = response.json()[:10]  # Get only last 10 entries
                for entry in data:
                    history_text = f"IP: {entry['ip']} | Location: {entry['city']}, {entry['country']} | Time: {entry['timestamp']}\n"
                    self.history_text.insert("end", history_text)
            else:
                print(colored(f"API error: {response.status_code}", "red"))
        except Exception as e:
            print(colored(f"Error updating history: {str(e)}", "red"))

    def open_map(self):
        try:
            map_path = os.path.abspath(MAP_PATH)
            if os.path.exists(map_path):
                print(colored(f"Opening map at: {map_path}", "blue"))
                # Utiliser file:// pour s'assurer que le chemin est bien interprété
                webbrowser.open('file://' + map_path)
                print(colored("Map opened in browser", "green"))
            else:
                print(colored("Map file not found. Generating new map...", "yellow"))
                self.update_map()
                webbrowser.open('file://' + map_path)
        except Exception as e:
            print(colored(f"Error opening map: {str(e)}", "red"))

    def create_history_view(self):
        self.history_frame = ctk.CTkFrame(self.main_frame)
        self.history_frame.pack(fill="x", padx=10, pady=10)

        self.history_label = ctk.CTkLabel(
            self.history_frame, 
            text="Recent IP History"
        )
        self.history_label.pack()

        self.history_text = ctk.CTkTextbox(
            self.history_frame, 
            height=150
        )
        self.history_text.pack(fill="x", padx=5, pady=5)

    def generate_tracking_link(self):
        try:
            youtube_url = self.url_entry.get()
            if not youtube_url:
                print(colored("Please enter a YouTube URL", "yellow"))
                return

            # Extract video ID from YouTube URL
            video_id = self.extract_video_id(youtube_url)
            if not video_id:
                print(colored("Invalid YouTube URL", "red"))
                return

            # Generate tracking link
            tracking_link = f"{SERVER_URL}/watch?v={video_id}"
            self.generated_link.delete(0, "end")
            self.generated_link.insert(0, tracking_link)
            print(colored("Tracking link generated successfully", "green"))

        except Exception as e:
            print(colored(f"Error generating tracking link: {str(e)}", "red"))

    def extract_video_id(self, url):
        try:
            if "youtu.be" in url:
                return url.split("/")[-1]
            elif "youtube.com" in url:
                return url.split("v=")[1].split("&")[0]
            return None
        except Exception:
            return None

    def copy_link(self):
        try:
            link = self.generated_link.get()
            if link:
                self.root.clipboard_clear()
                self.root.clipboard_append(link)
                print(colored("Link copied to clipboard", "green"))
            else:
                print(colored("No link to copy", "yellow"))
        except Exception as e:
            print(colored(f"Error copying link: {str(e)}", "red"))

    def update_map(self):
        try:
            print(colored(f"Trying to fetch data from: {SERVER_URL}/api/tracked-ips", "blue"))
            
            # Test server connection first
            if not self.check_server_connection():
                print(colored("Server connection failed, cannot update map", "red"))
                return

            # Create base map
            m = folium.Map(
                location=[39.03, -77.5],
                zoom_start=4,
                tiles="cartodbdark_matter"
            )

            # Get data from API with error handling
            try:
                response = requests.get(f"{SERVER_URL}/api/tracked-ips")
                print(colored(f"API Response status: {response.status_code}", "blue"))
                print(colored(f"API Response content: {response.text[:200]}...", "blue"))
                
                if response.status_code == 200:
                    data = response.json()
                    print(colored(f"Found {len(data)} entries from API", "green"))

                    for row in data:
                        print(colored(f"Adding marker for: {row}", "blue"))
                        folium.Marker(
                            location=[row['latitude'], row['longitude']],
                            popup=f"IP: {row['ip']}<br>Location: {row['city']}, {row['country']}<br>Time: {row['timestamp']}",
                            icon=folium.Icon(color='red')
                        ).add_to(m)
                else:
                    print(colored(f"API error: {response.status_code}", "red"))
                    print(colored(f"Error response: {response.text}", "red"))
            except Exception as e:
                print(colored(f"Error fetching data from API: {str(e)}", "red"))
                import traceback
                print(colored(traceback.format_exc(), "red"))

            # Save map
            m.save(MAP_PATH)
            print(colored("Map updated with all markers", "green"))

        except Exception as e:
            print(colored(f"Error updating map: {str(e)}", "red"))
            import traceback
            print(colored(traceback.format_exc(), "red"))

    def check_database(self):
        try:
            response = requests.get(f"{SERVER_URL}/api/tracked-ips")
            if response.status_code == 200:
                data = response.json()
                print(colored("\nAPI Data contents:", "blue"))
                for entry in data:
                    print(colored(f"Entry: {entry}", "green"))
            else:
                print(colored(f"API error: {response.status_code}", "red"))
        except Exception as e:
            print(colored(f"Error checking API data: {str(e)}", "red"))

    def check_server_connection(self):
        try:
            response = requests.get(f"{SERVER_URL}/api/test")
            if response.status_code == 200:
                print(colored("Server connection test successful", "green"))
                return True
            else:
                print(colored(f"Server connection test failed: {response.status_code}", "red"))
                return False
        except Exception as e:
            print(colored(f"Server connection error: {str(e)}", "red"))
            return False

    def run(self):
        try:
            self.root.mainloop()
        except Exception as e:
            print(colored(f"Error in main loop: {str(e)}", "red"))

if __name__ == "__main__":
    try:
        app = IPLoggerApp()
        app.run()
    except Exception as e:
        print(colored(f"Fatal error: {str(e)}", "red")) 