import bcrypt from 'bcryptjs';

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatDateTime = (date) =>
  `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

const addDays = (days, hour = 9) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

const lastSchoolDays = (count) => {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
};

const STUDENTS = [
  {
    first: 'Maria',
    last: 'Santos',
    program: 'BS Information Technology',
    year: 2,
    section: 'A',
    dob: '2004-03-12',
    gender: 'Female',
    phone: '0917 845 2210',
    address: '12 Mabini Street, Quezon City',
    guardian: 'Rosario Santos',
    guardianPhone: '0918 220 4411',
  },
  {
    first: 'Juan',
    last: 'Dela Cruz',
    program: 'BS Computer Science',
    year: 1,
    section: 'B',
    dob: '2005-07-24',
    gender: 'Male',
    phone: '0916 302 7788',
    address: '48 Rizal Avenue, Makati City',
    guardian: 'Pedro Dela Cruz',
    guardianPhone: '0917 778 3322',
  },
  {
    first: 'Ana',
    last: 'Reyes',
    program: 'BS Information Technology',
    year: 3,
    section: 'A',
    dob: '2003-11-05',
    gender: 'Female',
    phone: '0920 554 1188',
    address: '7 Katipunan Road, Marikina City',
    guardian: 'Lourdes Reyes',
    guardianPhone: '0921 118 5544',
  },
  {
    first: 'Mark',
    last: 'Villanueva',
    program: 'BS Computer Science',
    year: 2,
    section: 'A',
    dob: '2004-01-18',
    gender: 'Male',
    phone: '0917 990 6633',
    address: '23 Aurora Boulevard, Pasig City',
    guardian: 'Cecilia Villanueva',
    guardianPhone: '0918 663 9900',
  },
  {
    first: 'Sofia',
    last: 'Garcia',
    program: 'BS Accountancy',
    year: 1,
    section: 'A',
    dob: '2005-09-30',
    gender: 'Female',
    phone: '0915 447 9012',
    address: '90 Shaw Boulevard, Mandaluyong City',
    guardian: 'Ramon Garcia',
    guardianPhone: '0917 901 4477',
  },
  {
    first: 'Liam',
    last: 'Mendoza',
    program: 'BS Nursing',
    year: 2,
    section: 'B',
    dob: '2004-05-14',
    gender: 'Male',
    phone: '0922 310 8855',
    address: '15 Ortigas Avenue, San Juan City',
    guardian: 'Teresa Mendoza',
    guardianPhone: '0923 885 3100',
  },
  {
    first: 'Chloe',
    last: 'Ramos',
    program: 'BS Information Technology',
    year: 1,
    section: 'B',
    dob: '2005-12-02',
    gender: 'Female',
    phone: '0919 226 7700',
    address: '33 España Boulevard, Manila',
    guardian: 'Alfredo Ramos',
    guardianPhone: '0920 770 2266',
  },
  {
    first: 'Noah',
    last: 'Bautista',
    program: 'BS Computer Science',
    year: 3,
    section: 'A',
    dob: '2003-08-21',
    gender: 'Male',
    phone: '0917 663 2099',
    address: '61 C-5 Road, Taguig City',
    guardian: 'Marites Bautista',
    guardianPhone: '0918 209 6633',
  },
];

const COURSES = [
  {
    code: 'IT101',
    title: 'Introduction to Computing',
    instructor: 'Prof. Elena Navarro',
    program: 'BS Information Technology',
    units: 3,
    schedule: 'MWF 8:00 - 9:00 AM',
    room: 'IT-201',
  },
  {
    code: 'IT201',
    title: 'Data Structures and Algorithms',
    instructor: 'Prof. Rafael Domingo',
    program: 'BS Information Technology',
    units: 3,
    schedule: 'TTh 9:30 - 11:00 AM',
    room: 'IT-204',
  },
  {
    code: 'IT301',
    title: 'Web Systems and Technologies',
    instructor: 'Prof. Carla Manalo',
    program: 'BS Information Technology',
    units: 3,
    schedule: 'MWF 10:00 - 11:00 AM',
    room: 'IT-302',
  },
  {
    code: 'CS101',
    title: 'Programming Fundamentals',
    instructor: 'Prof. Daniel Ocampo',
    program: 'BS Computer Science',
    units: 3,
    schedule: 'MWF 9:00 - 10:00 AM',
    room: 'CS-101',
  },
  {
    code: 'CS201',
    title: 'Database Management Systems',
    instructor: 'Prof. Grace Lim',
    program: 'BS Computer Science',
    units: 3,
    schedule: 'TTh 1:00 - 2:30 PM',
    room: 'CS-203',
  },
  {
    code: 'ACC101',
    title: 'Financial Accounting',
    instructor: 'Prof. Marisol Aquino',
    program: 'BS Accountancy',
    units: 3,
    schedule: 'MWF 8:30 - 9:30 AM',
    room: 'AB-105',
  },
  {
    code: 'NUR101',
    title: 'Anatomy and Physiology',
    instructor: 'Prof. Teresa Salazar',
    program: 'BS Nursing',
    units: 4,
    schedule: 'TTh 7:00 - 9:00 AM',
    room: 'HS-110',
  },
  {
    code: 'GE101',
    title: 'Understanding the Self',
    instructor: 'Prof. Benjie Flores',
    program: 'General',
    units: 3,
    schedule: 'TTh 10:00 - 11:30 AM',
    room: 'GE-101',
  },
  {
    code: 'GE102',
    title: 'Purposive Communication',
    instructor: 'Prof. Lorna Pascual',
    program: 'General',
    units: 3,
    schedule: 'MWF 1:00 - 2:00 PM',
    room: 'GE-102',
  },
  {
    code: 'PE101',
    title: 'Physical Fitness and Wellness',
    instructor: 'Coach Rico Alonzo',
    program: 'General',
    units: 2,
    schedule: 'Sat 8:00 - 10:00 AM',
    room: 'Gym',
  },
];

const BOOKS = [
  {
    isbn: '978-0073523323',
    title: 'Database System Concepts',
    author: 'Abraham Silberschatz',
    category: 'Computer Science',
    copies: 4,
  },
  {
    isbn: '978-0132350884',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    category: 'Computer Science',
    copies: 3,
  },
  {
    isbn: '978-0262033848',
    title: 'Introduction to Algorithms',
    author: 'Thomas H. Cormen',
    category: 'Computer Science',
    copies: 3,
  },
  {
    isbn: '978-0323358610',
    title: 'Fundamentals of Nursing',
    author: 'Patricia A. Potter',
    category: 'Nursing',
    copies: 4,
  },
  {
    isbn: '978-0138025293',
    title: 'Financial Accounting',
    author: 'Walter T. Harrison',
    category: 'Accountancy',
    copies: 2,
  },
  {
    isbn: '978-1491949306',
    title: 'Web Development with Node and Express',
    author: 'Ethan Brown',
    category: 'Information Technology',
    copies: 3,
  },
  {
    isbn: '978-1491954621',
    title: 'Learning React',
    author: 'Alex Banks',
    category: 'Information Technology',
    copies: 3,
  },
  {
    isbn: '978-0134874438',
    title: 'Anatomy & Physiology',
    author: 'Elaine N. Marieb',
    category: 'Nursing',
    copies: 3,
  },
  {
    isbn: '978-0135957059',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt',
    category: 'Information Technology',
    copies: 2,
  },
  {
    isbn: '978-0134492513',
    title: 'Principles of Marketing',
    author: 'Philip Kotler',
    category: 'Business',
    copies: 3,
  },
];

const LOAN_PATTERNS = [
  { student: 0, book: 0, borrowed: -5, due: 9, returned: null },
  { student: 1, book: 1, borrowed: -18, due: -4, returned: null },
  { student: 2, book: 2, borrowed: -20, due: -6, returned: -12 },
  { student: 3, book: 3, borrowed: -2, due: 12, returned: null },
  { student: 4, book: 4, borrowed: -25, due: -11, returned: null },
  { student: 5, book: 5, borrowed: -7, due: 7, returned: null },
  { student: 6, book: 6, borrowed: -30, due: -16, returned: -18 },
  { student: 7, book: 7, borrowed: -1, due: 13, returned: null },
  { student: 0, book: 8, borrowed: -22, due: -8, returned: -10 },
  { student: 1, book: 9, borrowed: -10, due: 4, returned: null },
];

const PAYMENT_PATTERNS = [
  { tuition: 9000, misc: 0 },
  { tuition: 18000, misc: 3500 },
  { tuition: 0, misc: 1500 },
  { tuition: 18000, misc: 0 },
  { tuition: 12000, misc: 3500 },
  { tuition: 0, misc: 0 },
  { tuition: 18000, misc: 3500 },
  { tuition: 18000, misc: 1000 },
];

const invoiceStatus = (amount, paid, dueDate) => {
  if (paid >= amount) return 'paid';
  if (paid > 0) return 'partial';
  return dueDate < formatDate(new Date()) ? 'overdue' : 'unpaid';
};

export async function seedDatabase(pool) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT COUNT(*) AS count FROM users');
    if (Number(existing[0].count) > 0) {
      await connection.rollback();
      return false;
    }

    const adminHash = await bcrypt.hash('admin123', 10);
    const studentHash = await bcrypt.hash('student123', 10);
    const librarianHash = await bcrypt.hash('library123', 10);

    const [adminResult] = await connection.query(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
      ['admin@school.edu', adminHash, 'admin', 'Regina Cruz'],
    );
    const adminId = adminResult.insertId;

    const [librarianResult] = await connection.query(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
      ['librarian@school.edu', librarianHash, 'librarian', 'Liza Fernandez'],
    );
    const librarianId = librarianResult.insertId;

    const courseIds = [];
    for (const course of COURSES) {
      const [result] = await connection.query(
        `INSERT INTO courses (code, title, instructor, program, units, schedule, room)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          course.code,
          course.title,
          course.instructor,
          course.program,
          course.units,
          course.schedule,
          course.room,
        ],
      );
      courseIds.push({ id: result.insertId, ...course });
    }

    const year = new Date().getFullYear();
    const students = [];

    for (let index = 0; index < STUDENTS.length; index += 1) {
      const student = STUDENTS[index];
      const name = `${student.first} ${student.last}`;
      const email = `${student.first}.${student.last}`.toLowerCase().replace(/\s+/g, '') + '@student.edu';
      const [userResult] = await connection.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
        [email, studentHash, 'student', name],
      );
      const userId = userResult.insertId;
      const studentNo = `${year}-${String(index + 1).padStart(4, '0')}`;
      const [studentResult] = await connection.query(
        `INSERT INTO students
          (user_id, student_no, first_name, last_name, dob, gender, email, phone, address,
           program, year_level, section, guardian_name, guardian_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          studentNo,
          student.first,
          student.last,
          student.dob,
          student.gender,
          email,
          student.phone,
          student.address,
          student.program,
          student.year,
          student.section,
          student.guardian,
          student.guardianPhone,
        ],
      );
      students.push({
        ...student,
        id: studentResult.insertId,
        userId,
        email,
        studentNo,
        name,
      });
    }

    const bookIds = [];
    for (const book of BOOKS) {
      const [result] = await connection.query(
        `INSERT INTO books (isbn, title, author, category, copies_total, copies_available)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [book.isbn, book.title, book.author, book.category, book.copies, book.copies],
      );
      bookIds.push(result.insertId);
    }

    const loanValues = [];
    for (const loan of LOAN_PATTERNS) {
      const student = students[loan.student];
      loanValues.push([
        student.id,
        bookIds[loan.book],
        formatDate(addDays(loan.borrowed)),
        formatDate(addDays(loan.due)),
        loan.returned !== null ? formatDate(addDays(loan.returned)) : null,
        loan.returned !== null ? 'returned' : 'borrowed',
        formatDateTime(addDays(loan.borrowed)),
      ]);
    }
    await connection.query(
      `INSERT INTO library_loans
        (student_id, book_id, date_borrowed, due_date, returned_at, status, created_at)
       VALUES ?`,
      [loanValues],
    );

    for (const loan of LOAN_PATTERNS) {
      if (loan.returned === null) {
        await connection.query(
          'UPDATE books SET copies_available = copies_available - 1 WHERE id = ?',
          [bookIds[loan.book]],
        );
      }
    }

    const matchedCourses = (student) =>
      courseIds.filter(
        (course) => course.program === student.program || course.program === 'General',
      );

    const enrollmentValues = [];
    for (const student of students) {
      for (const course of matchedCourses(student)) {
        enrollmentValues.push([student.id, course.id, 'enrolled']);
      }
    }
    await connection.query(
      'INSERT INTO enrollments (student_id, course_id, status) VALUES ?',
      [enrollmentValues],
    );

    const schoolDays = lastSchoolDays(12);
    const attendanceValues = [];
    students.forEach((student, studentIndex) => {
      matchedCourses(student).forEach((course, courseIndex) => {
        schoolDays.forEach((date, dayIndex) => {
          const value = (studentIndex * 17 + courseIndex * 7 + dayIndex * 13) % 100;
          let status = 'present';
          let remarks = null;
          if (value < 4) {
            status = 'absent';
            remarks = 'Unexcused absence';
          } else if (value < 10) {
            status = 'late';
            remarks = 'Arrived after roll call';
          } else if (value < 13) {
            status = 'excused';
            remarks = 'Excused with letter';
          }
          attendanceValues.push([
            student.id,
            course.id,
            formatDate(date),
            status,
            remarks,
          ]);
        });
      });
    });
    await connection.query(
      `INSERT INTO attendance (student_id, course_id, attendance_date, status, remarks) VALUES ?`,
      [attendanceValues],
    );

    const gradeValues = [];
    students.forEach((student, studentIndex) => {
      matchedCourses(student).forEach((course, courseIndex) => {
        const base = 72 + ((studentIndex * 9 + courseIndex * 5) % 24);
        const items = [
          ['Quiz 1', 'Prelim', Math.min(100, base - 3 + ((studentIndex + courseIndex) % 5))],
          ['Midterm Exam', 'Midterm', Math.min(100, base + ((studentIndex * 3 + courseIndex) % 6) - 2)],
          ['Final Project', 'Finals', Math.min(100, base + 2 + ((studentIndex + courseIndex * 2) % 4))],
        ];
        for (const [assignment, term, score] of items) {
          gradeValues.push([student.id, course.id, term, assignment, score, 100]);
        }
      });
    });
    await connection.query(
      `INSERT INTO grades (student_id, course_id, term, assignment, score, max_score) VALUES ?`,
      [gradeValues],
    );

    const paymentValues = [];
    const notificationValues = [];
    const announcementDate = formatDateTime(addDays(-5, 10));

    const addNotification = (
      userId,
      title,
      message,
      type,
      channel,
      isRead,
      daysAgo,
      hour = 9,
    ) => {
      notificationValues.push([
        userId,
        title,
        message,
        type,
        channel,
        isRead,
        formatDateTime(addDays(-daysAgo, hour)),
      ]);
    };

    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      const pattern = PAYMENT_PATTERNS[index];
      const tuitionDue = formatDate(addDays(-20));
      const miscDue = formatDate(addDays(12));
      const tuitionStatus = invoiceStatus(18000, pattern.tuition, tuitionDue);
      const miscStatus = invoiceStatus(3500, pattern.misc, miscDue);

      const [tuitionResult] = await connection.query(
        `INSERT INTO invoices (invoice_no, student_id, description, amount, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `INV-${year}-${String(index * 2 + 1).padStart(4, '0')}`,
          student.id,
          `Tuition Fee - First Semester ${year}`,
          18000,
          tuitionDue,
          tuitionStatus,
          formatDateTime(addDays(-40)),
        ],
      );

      const [miscResult] = await connection.query(
        `INSERT INTO invoices (invoice_no, student_id, description, amount, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `INV-${year}-${String(index * 2 + 2).padStart(4, '0')}`,
          student.id,
          'Laboratory and Miscellaneous Fees',
          3500,
          miscDue,
          miscStatus,
          formatDateTime(addDays(-10)),
        ],
      );

      const methods = ['cash', 'online', 'card', 'bank_transfer'];
      if (pattern.tuition > 0) {
        paymentValues.push([
          tuitionResult.insertId,
          pattern.tuition,
          methods[index % methods.length],
          `PAY-${year}-${String(index * 2 + 1).padStart(4, '0')}`,
          formatDateTime(addDays(-14, 11)),
        ]);
      }
      if (pattern.misc > 0) {
        paymentValues.push([
          miscResult.insertId,
          pattern.misc,
          methods[(index + 1) % methods.length],
          `PAY-${year}-${String(index * 2 + 2).padStart(4, '0')}`,
          formatDateTime(addDays(-4, 14)),
        ]);
      }

      addNotification(
        student.userId,
        'Welcome to the SIS student portal',
        'Your account is ready. Sign in to view your profile, class schedule, grades, and billing records.',
        'enrollment',
        'in_app,email',
        1,
        21,
      );

      const focusCourse = matchedCourses(student)[0];
      addNotification(
        student.userId,
        `New grade posted in ${focusCourse.code}`,
        `Your grade for "Quiz 1" in ${focusCourse.title} has been released. Open the LMS module to review it.`,
        'grade',
        'in_app,email',
        index % 3 === 0,
        3,
        10,
      );

      const outstanding = 18000 - pattern.tuition + (3500 - pattern.misc);
      if (outstanding > 0) {
        addNotification(
          student.userId,
          'Payment reminder',
          `You have an outstanding balance of PHP ${outstanding.toLocaleString('en-US')}. Please settle it before the due date to keep your enrollment active.`,
          'payment',
          'in_app,email,sms',
          0,
          1,
          8,
        );
      }

      if (index === 2 || index === 5) {
        addNotification(
          student.userId,
          'Attendance reminder',
          `You were marked absent in ${focusCourse.code}. Please coordinate with your instructor if this needs correction.`,
          'attendance',
          'in_app,sms',
          0,
          2,
          7,
        );
      }

      addNotification(
        student.userId,
        'First Semester enrollment is open',
        'Enrollment for the First Semester is now open. Check your balance and clear any pending fees to activate all classes.',
        'announcement',
        'in_app,email',
        index % 2 === 0,
        5,
        10,
      );
    }

    for (const loan of LOAN_PATTERNS) {
      if (loan.returned !== null) continue;
      const student = students[loan.student];
      const book = BOOKS[loan.book];
      const overdue = loan.due < 0;
      addNotification(
        student.userId,
        overdue ? `Overdue book: ${book.title}` : `Book borrowed: ${book.title}`,
        overdue
          ? `"${book.title}" was due ${Math.abs(loan.due)} day(s) ago. Please return it to the library to avoid additional fines.`
          : `You borrowed "${book.title}". The due date is ${formatDate(addDays(loan.due))}.`,
        'library',
        'in_app,email',
        overdue ? 0 : 1,
        Math.abs(loan.borrowed),
        15,
      );
    }

    if (paymentValues.length) {
      await connection.query(
        `INSERT INTO payments (invoice_id, amount, method, reference, paid_at) VALUES ?`,
        [paymentValues],
      );
    }

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, channel, is_read, created_at) VALUES ?`,
      [notificationValues],
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        'Overdue accounts need attention',
        'Several student accounts have overdue invoices. Open the Billing module to review and record payments.',
        'payment',
        'in_app',
        0,
        formatDateTime(addDays(-1, 8)),
      ],
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        'Welcome to the SIS admin console',
        'You can manage students, enrollment, attendance, billing, library loans, and announcements from a single dashboard.',
        'system',
        'in_app',
        1,
        announcementDate,
      ],
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        librarianId,
        'Library module ready',
        'You can record book loans, process returns, and monitor overdue items from the Library Loans workspace.',
        'library',
        'in_app',
        1,
        formatDateTime(addDays(-3, 8)),
      ],
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        librarianId,
        'Overdue books need follow-up',
        'Some borrowed books are past their due date. Review the Library Loans page and contact the students listed.',
        'library',
        'in_app,email',
        0,
        formatDateTime(addDays(-1, 9)),
      ],
    );

    await connection.query(
      `INSERT INTO audit_logs (user_id, actor, role, method, path, status, ip, created_at) VALUES ?`,
      [
        [
          [adminId, 'Regina Cruz', 'admin', 'POST', '/api/students', 201, '127.0.0.1', formatDateTime(addDays(-6, 9))],
          [adminId, 'Regina Cruz', 'admin', 'POST', '/api/enrollments', 201, '127.0.0.1', formatDateTime(addDays(-6, 9))],
          [librarianId, 'Liza Fernandez', 'librarian', 'POST', '/api/library/loans', 201, '127.0.0.1', formatDateTime(addDays(-5, 10))],
          [adminId, 'Regina Cruz', 'admin', 'PATCH', '/api/enrollments/1', 200, '127.0.0.1', formatDateTime(addDays(-4, 14))],
          [librarianId, 'Liza Fernandez', 'librarian', 'PATCH', '/api/library/loans/3/return', 200, '127.0.0.1', formatDateTime(addDays(-2, 11))],
          [adminId, 'Regina Cruz', 'admin', 'PATCH', '/api/library/loans/5/return', 200, '127.0.0.1', formatDateTime(addDays(-1, 15))],
        ],
      ],
    );

    await connection.commit();
    console.log('[db] demo data seeded');
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
