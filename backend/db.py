import sqlite3

DATABASE = "database.db"

def get_db_connection():
    """เชื่อมต่อกับฐานข้อมูล SQLite"""
    try:
        conn = sqlite3.connect(DATABASE, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        print("Error connecting to database:", e)
        return None

def initialize_database():
    """สร้างตารางฐานข้อมูลอัตโนมัติถ้ายังไม่มี"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS Student (
        Student_id TEXT PRIMARY KEY,
        Full_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Subject (
        Subject_id TEXT PRIMARY KEY,
        Subject_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Enrollment (
        Student_id TEXT,
        Subject_id TEXT,
        Section INTEGER NOT NULL,
        Total REAL DEFAULT 0,
        PRIMARY KEY (Student_id, Subject_id),
        FOREIGN KEY (Student_id) REFERENCES Student(Student_id) ON UPDATE CASCADE,
        FOREIGN KEY (Subject_id) REFERENCES Subject(Subject_id) ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Page (
        Page_id INTEGER PRIMARY KEY AUTOINCREMENT,
        Subject_id TEXT,
        Page_no INTEGER NOT NULL,
        FOREIGN KEY (Subject_id) REFERENCES Subject(Subject_id) ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Group_Point (
        Group_No INTEGER PRIMARY KEY AUTOINCREMENT,
        Point_Group REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Label (
        Label_id INTEGER PRIMARY KEY AUTOINCREMENT,
        Subject_id TEXT,
        No INTEGER NOT NULL,
        Answer TEXT DEFAULT NULL,
        Group_No INTEGER DEFAULT NULL,
        Point_single REAL DEFAULT NULL,
        Type TEXT DEFAULT NULL,
        Free BOOLEAN DEFAULT 0,
        "Update" BOOLEAN DEFAULT 0,
        FOREIGN KEY (Subject_id) REFERENCES Subject(Subject_id) ON UPDATE CASCADE,
        FOREIGN KEY (Group_No) REFERENCES Group_Point(Group_No) ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Exam_sheet (
        Sheet_id INTEGER PRIMARY KEY AUTOINCREMENT,
        Page_id INTEGER,
        Id_predict TEXT DEFAULT NULL,
        Score REAL DEFAULT NULL,
        Status BOOLEAN DEFAULT 0,
        FOREIGN KEY (Page_id) REFERENCES Page(Page_id) ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Answer (
        Ans_id INTEGER PRIMARY KEY AUTOINCREMENT,
        Label_id INTEGER,
        Modelread TEXT DEFAULT NULL,
        Sheet_id INTEGER,
        Score_point REAL DEFAULT 0,
        FOREIGN KEY (Label_id) REFERENCES Label(Label_id) ON UPDATE CASCADE,
        FOREIGN KEY (Sheet_id) REFERENCES Exam_sheet(Sheet_id) ON UPDATE CASCADE
    );
    """)

    conn.commit()
    conn.close()
    print("Database initialized successfully.")

#สำหรับอัพเดต att 
def add_update_column_if_not_exists():
    conn = get_db_connection()
    cursor = conn.cursor()

    # ตรวจสอบว่ามีคอลัมน์ "Update" อยู่หรือยัง
    cursor.execute("PRAGMA table_info(Label);")
    columns = [col[1] for col in cursor.fetchall()]

    if "Update" not in columns:
        cursor.execute('ALTER TABLE Label ADD COLUMN "Update" BOOLEAN DEFAULT 0;')
        print("เพิ่มคอลัมน์ 'Update' สำเร็จแล้ว")
    else:
        print("คอลัมน์ 'Update' มีอยู่แล้ว")

    conn.commit()
    conn.close()


# เรียกใช้การสร้างฐานข้อมูลทันทีที่โมดูลถูก import
initialize_database()
#สำหรับอัพเดต att ลบได้ถ้าสร้างใหม่หมด
add_update_column_if_not_exists()
