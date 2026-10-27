import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDate } from '../lib/api.js';
import {
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/ui.jsx';
import {
  BookIcon,
  EditIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from '../components/Icons.jsx';

const FILTERS = [
  { value: 'all', label: 'All loans' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Returned' },
];

const EMPTY_BOOK = {
  isbn: '',
  title: '',
  author: '',
  category: 'General',
  copies_total: 1,
};

function defaultDueDate(days = 14) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function Library() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStaff = user?.role === 'admin' || user?.role === 'librarian';
  const isAdmin = user?.role === 'admin';

  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [bookSearch, setBookSearch] = useState('');

  const [loanOpen, setLoanOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({
    student_id: '',
    book_id: '',
    due_date: defaultDueDate(),
  });
  const [loanError, setLoanError] = useState('');
  const [savingLoan, setSavingLoan] = useState(false);

  const [bookOpen, setBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [bookError, setBookError] = useState('');
  const [savingBook, setSavingBook] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [returningId, setReturningId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all([
        api.get('/library/books'),
        api.get('/library/loans'),
        isStaff ? api.get('/library/students') : Promise.resolve({ students: [] }),
      ]);
      setBooks(responses[0].books);
      setLoans(responses[1].loans);
      setStudents(responses[2].students);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [isStaff]);

  const visibleLoans = useMemo(
    () => (filter === 'all' ? loans : loans.filter((loan) => loan.status === filter)),
    [loans, filter],
  );

  const visibleBooks = useMemo(() => {
    const term = bookSearch.trim().toLowerCase();
    if (!term) return books;
    return books.filter((book) =>
      [book.title, book.author, book.isbn, book.category]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [books, bookSearch]);

  const activeLoans = loans.filter((loan) => loan.status !== 'returned');
  const overdueLoans = loans.filter((loan) => loan.status === 'overdue');
  const availableCopies = books.reduce((total, book) => total + Number(book.copies_available), 0);

  function openLoan() {
    setLoanForm({
      student_id: students[0] ? String(students[0].id) : '',
      book_id: '',
      due_date: defaultDueDate(),
    });
    setLoanError('');
    setLoanOpen(true);
  }

  function openAddBook() {
    setEditingBook(null);
    setBookForm(EMPTY_BOOK);
    setBookError('');
    setBookOpen(true);
  }

  function openEditBook(book) {
    setEditingBook(book);
    setBookForm({
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      category: book.category,
      copies_total: book.copies_total,
    });
    setBookError('');
    setBookOpen(true);
  }

  async function submitLoan(event) {
    event.preventDefault();
    setSavingLoan(true);
    setLoanError('');
    try {
      await api.post('/library/loans', {
        student_id: Number(loanForm.student_id),
        book_id: Number(loanForm.book_id),
        due_date: loanForm.due_date,
      });
      toast('Book loan recorded');
      setLoanOpen(false);
      await load();
    } catch (requestError) {
      setLoanError(requestError.message);
    } finally {
      setSavingLoan(false);
    }
  }

  async function submitBook(event) {
    event.preventDefault();
    setSavingBook(true);
    setBookError('');
    try {
      const payload = { ...bookForm, copies_total: Number(bookForm.copies_total) };
      if (editingBook) {
        await api.put(`/library/books/${editingBook.id}`, payload);
        toast('Book updated');
      } else {
        await api.post('/library/books', payload);
        toast('Book added to the catalog');
      }
      setBookOpen(false);
      await load();
    } catch (requestError) {
      setBookError(requestError.message);
    } finally {
      setSavingBook(false);
    }
  }

  async function returnLoan(loan) {
    setReturningId(loan.id);
    try {
      await api.patch(`/library/loans/${loan.id}/return`);
      toast(`"${loan.title}" marked as returned`);
      await load();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setReturningId(null);
    }
  }

  async function removeBook() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/library/books/${deleteTarget.id}`);
      toast('Book removed from the catalog');
      setDeleteTarget(null);
      await load();
    } catch (requestError) {
      toast(requestError.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Loading label="Loading library records..." />;

  return (
    <div className="page">
      <PageHeader
        title={isStaff ? 'Library Loans' : 'My Library'}
        subtitle={
          isStaff
            ? 'Record loans and returns, manage the catalog, and track overdue books.'
            : 'View your borrowed books, due dates, and the library catalog.'
        }
        actions={
          isStaff ? (
            <button type="button" className="btn btn-primary" onClick={openLoan}>
              <PlusIcon size={17} />
              Record loan
            </button>
          ) : null
        }
      />

      {error && <div className="form-error">{error}</div>}

      <div className="summary-strip">
        <div>
          <span>Loans shown</span>
          <strong>{loans.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeLoans.length}</strong>
        </div>
        <div>
          <span>Overdue</span>
          <strong className={overdueLoans.length ? 'amount-due' : ''}>{overdueLoans.length}</strong>
        </div>
        <div>
          <span>Available copies</span>
          <strong>{availableCopies}</strong>
        </div>
        <div className="summary-note">
          Recording a loan updates book availability and sends an in-app and email notice to the
          student. The audit trail records every change.
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Loan records</h2>
            <p className="card-sub">
              {isStaff ? 'All student loans across the library' : 'Your borrowing history'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshIcon size={15} />
            Refresh
          </button>
        </div>

        <div className="filter-tabs">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`filter-tab ${filter === item.value ? 'active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {visibleLoans.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={26} />}
            title="No loan records"
            message="Books borrowed from the library will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {isStaff && <th>Student</th>}
                  <th>Book</th>
                  <th>Borrowed</th>
                  <th>Due date</th>
                  <th>Returned</th>
                  <th>Status</th>
                  {isStaff && <th className="text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {visibleLoans.map((loan) => (
                  <tr key={loan.id}>
                    {isStaff && (
                      <td>
                        <div className="stacked-cell">
                          <strong>{loan.student_name}</strong>
                          <span>{loan.student_no}</span>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="stacked-cell">
                        <strong>{loan.title}</strong>
                        <span>{loan.author}</span>
                      </div>
                    </td>
                    <td className="mono">{formatDate(loan.date_borrowed)}</td>
                    <td className="mono">
                      <span className={loan.status === 'overdue' ? 'amount-due' : ''}>
                        {formatDate(loan.due_date)}
                      </span>
                    </td>
                    <td className="mono">{loan.returned_at ? formatDate(loan.returned_at) : 'N/A'}</td>
                    <td>
                      <StatusBadge status={loan.status} />
                    </td>
                    {isStaff && (
                      <td>
                        <div className="row-actions">
                          {loan.status !== 'returned' ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={returningId === loan.id}
                              onClick={() => returnLoan(loan)}
                            >
                              {returningId === loan.id ? 'Returning...' : 'Mark returned'}
                            </button>
                          ) : (
                            <span className="helper">Closed</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Book catalog</h2>
            <p className="card-sub">A curated catalog for the campus library</p>
          </div>
          {isStaff && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={openAddBook}>
              <PlusIcon size={15} />
              Add book
            </button>
          )}
        </div>

        <div className="table-toolbar">
          <div className="search-box">
            <SearchIcon size={18} />
            <input
              value={bookSearch}
              onChange={(event) => setBookSearch(event.target.value)}
              placeholder="Search by title, author, ISBN, or category"
            />
          </div>
        </div>

        {visibleBooks.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={26} />}
            title="No books found"
            message="Try a different search term or add a new title."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>ISBN</th>
                  <th>Category</th>
                  <th className="text-right">Available</th>
                  {isStaff && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleBooks.map((book) => (
                  <tr key={book.id}>
                    <td>
                      <div className="stacked-cell">
                        <strong>{book.title}</strong>
                        <span>{book.author}</span>
                      </div>
                    </td>
                    <td className="mono">{book.isbn}</td>
                    <td>
                      <span className="code-pill">{book.category}</span>
                    </td>
                    <td className="text-right">
                      <strong>{book.copies_available}</strong>
                      <span className="helper"> / {book.copies_total}</span>
                    </td>
                    {isStaff && (
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit book"
                            onClick={() => openEditBook(book)}
                          >
                            <EditIcon size={17} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Remove book"
                              onClick={() => setDeleteTarget(book)}
                            >
                              <TrashIcon size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={loanOpen}
        onClose={() => setLoanOpen(false)}
        title="Record a book loan"
        subtitle="The student is notified and the book's availability is updated automatically."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setLoanOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="loan-form" className="btn btn-primary" disabled={savingLoan}>
              {savingLoan ? 'Recording...' : 'Record loan'}
            </button>
          </>
        }
      >
        <form id="loan-form" onSubmit={submitLoan}>
          {loanError && <div className="form-error">{loanError}</div>}
          <div className="form-grid">
            <label className="field field-full">
              <span>Student</span>
              <select
                value={loanForm.student_id}
                onChange={(event) => setLoanForm({ ...loanForm, student_id: event.target.value })}
                required
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.full_name} ({student.student_no})
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Book</span>
              <select
                value={loanForm.book_id}
                onChange={(event) => setLoanForm({ ...loanForm, book_id: event.target.value })}
                required
              >
                <option value="">Select an available book</option>
                {books
                  .filter((book) => Number(book.copies_available) > 0)
                  .map((book) => (
                    <option value={book.id} key={book.id}>
                      {book.title} ({book.copies_available} available)
                    </option>
                  ))}
              </select>
            </label>
            <label className="field field-full">
              <span>Due date</span>
              <input
                type="date"
                value={loanForm.due_date}
                onChange={(event) => setLoanForm({ ...loanForm, due_date: event.target.value })}
                required
              />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        title={editingBook ? 'Edit book' : 'Add book'}
        subtitle="Catalog records are shared by every module that reads library data."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setBookOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="book-form" className="btn btn-primary" disabled={savingBook}>
              {savingBook ? 'Saving...' : editingBook ? 'Save changes' : 'Add book'}
            </button>
          </>
        }
      >
        <form id="book-form" onSubmit={submitBook}>
          {bookError && <div className="form-error">{bookError}</div>}
          <div className="form-grid">
            <label className="field">
              <span>ISBN</span>
              <input
                value={bookForm.isbn}
                onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })}
                placeholder="978-0000000000"
                required
              />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                value={bookForm.category}
                onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })}
                placeholder="General"
              />
            </label>
            <label className="field field-full">
              <span>Title</span>
              <input
                value={bookForm.title}
                onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
                required
              />
            </label>
            <label className="field field-full">
              <span>Author</span>
              <input
                value={bookForm.author}
                onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })}
                required
              />
            </label>
            <label className="field field-full">
              <span>Total copies</span>
              <input
                type="number"
                min="1"
                value={bookForm.copies_total}
                onChange={(event) =>
                  setBookForm({ ...bookForm, copies_total: event.target.value })
                }
                required
              />
              <small>Copies currently on loan stay reserved when the total changes.</small>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove book"
        subtitle="This permanently removes the title from the catalog."
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={removeBook} disabled={deleting}>
              {deleting ? 'Removing...' : 'Remove book'}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <p className="confirm-text">
            Remove <strong>{deleteTarget.title}</strong> from the catalog? Active loans must be
            returned first.
          </p>
        )}
      </Modal>
    </div>
  );
}
