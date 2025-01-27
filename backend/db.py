import mysql.connector
from mysql.connector import Error
from config import db_config

def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        if connection.is_connected():
            print("Connection to the database was successful!")
        return connection
    except Error as e:
        print(f"Error connecting to the database: {e}")
        return None