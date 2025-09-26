#!/usr/bin/env python3
"""
Script to upload monthly attendance summary data
"""
import requests
import os
import json

def upload_monthly_attendance():
    """Upload monthly attendance summary data"""
    
    # Step 1: Authenticate
    auth_url = "/api/public/login/"
    login_data = {
        "email": "test@client.com",
        "password": "Test@123"
    }
    
    print("🔐 Authenticating...")
    try:
        auth_response = requests.post(auth_url, json=login_data)
        
        if auth_response.status_code == 200:
            auth_result = auth_response.json()
            token = auth_result.get('access') or auth_result.get('access_token') or auth_result.get('token')
            
            if not token:
                print("❌ No token found in response")
                return False
                
            print("✅ Authentication successful!")
            
            # Step 2: Upload monthly attendance data via API
            upload_url = "/api/upload-monthly-attendance/"
            
            # Prepare the monthly attendance data
            monthly_data = {
                "month": "7",
                "year": "2022",
                "data": []
            }
            
            # Read and process the Excel file
            import pandas as pd
            df = pd.read_excel("July_2022_Attendance.xlsx")
            
            print(f"📊 Processing {len(df)} monthly attendance records...")
            
            for index, row in df.iterrows():
                try:
                    # Clean and validate data
                    employee_id = str(row['Employee ID']).strip()
                    name = str(row['Name']).strip()
                    department = str(row.get('Department', '')).strip()
                    
                    # Handle numeric fields
                    present_days = float(row.get('Present Days', 0)) if pd.notna(row.get('Present Days')) else 0
                    absent_days = float(row.get('Absent Days', 0)) if pd.notna(row.get('Absent Days')) else 0
                    ot_hours = float(row.get('OT Hours', 0)) if pd.notna(row.get('OT Hours')) else 0
                    late_minutes = int(row.get('Late Minutes', 0)) if pd.notna(row.get('Late Minutes')) else 0
                    
                    # Calculate total working days
                    total_working_days = present_days + absent_days
                    
                    record = {
                        "employee_id": employee_id,
                        "name": name,
                        "department": department,
                        "present_days": present_days,
                        "absent_days": absent_days,
                        "total_working_days": total_working_days,
                        "ot_hours": ot_hours,
                        "late_minutes": late_minutes
                    }
                    
                    monthly_data["data"].append(record)
                    
                except Exception as e:
                    print(f"⚠️ Error processing row {index + 2}: {e}")
                    continue
            
            print(f"✅ Prepared {len(monthly_data['data'])} records for upload")
            
            # Upload the data
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            print("📤 Uploading monthly attendance data...")
            upload_response = requests.post(upload_url, json=monthly_data, headers=headers)
            
            if upload_response.status_code in [200, 201]:
                result = upload_response.json()
                print(f"✅ Upload successful!")
                print(f"📊 Records processed: {result.get('total_records', 'N/A')}")
                print(f"✅ Successfully created: {result.get('created', 'N/A')}")
                print(f"⚠️ Failed: {result.get('failed', 'N/A')}")
                if result.get('errors'):
                    print(f"❌ Errors: {result['errors'][:5]}")  # Show first 5 errors
                return True
            else:
                print(f"❌ Upload failed with status {upload_response.status_code}")
                print(f"Response: {upload_response.text}")
                return False
                
        else:
            print(f"❌ Authentication failed with status {auth_response.status_code}")
            print(f"Response: {auth_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    upload_monthly_attendance()
