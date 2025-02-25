import os
import customtkinter as ctk
import sqlite3
from termcolor import colored
import folium
import webbrowser
from PIL import Image
import json
import requests
from datetime import datetime

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
            
            try:
                video_id = youtube_url.split('v=')[-1].split('&')[0]
            except:
                print(colored("Invalid YouTube URL format", "red"))
                return
            
            try:
                response = requests.get(f"{SERVER_URL}/api/shorten", params={
                    'url': f"{SERVER_URL}/watch?v={video_id}"
                })
                
                if response.status_code == 200:
                    data = response.json()
                    # Afficher l'URL YouTube-like
                    self.generated_link.delete(0, 'end')
                    self.generated_link.insert(0, data['shortUrl'])
                    # Mais copier l'URL de tracking
                    self.tracking_url = data['trackingUrl']
                    print(colored("Tracking link generated successfully", "green"))
                    print(colored(f"Display URL: {data['shortUrl']}", "blue"))
                    print(colored(f"Tracking URL: {data['trackingUrl']}", "blue"))
                else:
                    print(colored(f"Error generating short URL: {response.status_code}", "red"))
                    print(colored(f"Error details: {response.text}", "red"))
            except requests.exceptions.RequestException as e:
                print(colored(f"Network error while generating short URL: {str(e)}", "red"))
            
        except Exception as e:
            print(colored(f"Error generating tracking link: {str(e)}", "red"))

    def copy_link(self):
        try:
            # Copier l'URL de tracking au lieu de l'URL affichée
            if hasattr(self, 'tracking_url'):
                self.root.clipboard_clear()
                self.root.clipboard_append(self.tracking_url)
                print(colored("Tracking link copied to clipboard", "green"))
            else:
                print(colored("No tracking link to copy", "yellow"))
        except Exception as e:
            print(colored(f"Error copying link: {str(e)}", "red"))

    def create_marker_popup(self, ip_data):
        """Crée un popup HTML formaté pour le marqueur"""
        timestamp = datetime.fromisoformat(ip_data['timestamp']).strftime('%d/%m/%Y %H:%M:%S')
        device = ip_data.get('deviceInfo', {})
        
        popup_html = f"""
        <div style="font-family: Arial, sans-serif; min-width: 200px;">
            <h3 style="color: #2b2b2b; margin: 0 0 10px 0; border-bottom: 2px solid #4a90e2;">Visitor Details</h3>
            
            <div style="margin-bottom: 10px;">
                <strong style="color: #4a90e2;">📍 Location</strong><br>
                {ip_data['city']}, {ip_data['country']}<br>
                <span style="color: #666;">({ip_data['latitude']}, {ip_data['longitude']})</span>
            </div>

            <div style="margin-bottom: 10px;">
                <strong style="color: #4a90e2;">🌐 Network</strong><br>
                IP: {ip_data['ip']}<br>
                ISP: {ip_data.get('isp', 'N/A')}<br>
                Organization: {ip_data.get('org', 'N/A')}<br>
                AS: {ip_data.get('as', 'N/A')}
            </div>

            <div style="margin-bottom: 10px;">
                <strong style="color: #4a90e2;">💻 Device</strong><br>
                Browser: {device.get('browser', 'N/A')} {device.get('browserVersion', '')}<br>
                OS: {device.get('os', 'N/A')}<br>
                Device: {device.get('device', 'N/A')}<br>
                Type: {'Mobile' if device.get('isMobile') else 'Desktop'}
            </div>

            <div style="margin-bottom: 5px;">
                <strong style="color: #4a90e2;">⏰ Other</strong><br>
                Time Zone: {ip_data.get('timezone', 'N/A')}<br>
                Visit Time: {timestamp}
            </div>
        </div>
        """
        return popup_html

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
                        popup_content = self.create_marker_popup(row)
                        folium.Marker(
                            location=[row['latitude'], row['longitude']],
                            popup=folium.Popup(popup_content, max_width=300),
                            icon=folium.Icon(color='red', icon='info-sign')
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