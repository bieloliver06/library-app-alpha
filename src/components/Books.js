// Books.js
import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { app, auth } from "../firebase";
import { Link } from "react-router-dom";
import EditBook from "./EditBook";
import { useHistory } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const Books = () => {
  const [user, setUser] = useState(null);
  const [books, setBooks] = useState([]);
  const db = getFirestore(app);
  const [editingBook, setEditingBook] = useState(null);
  const [editingBookId, setEditingBookId] = useState(null);
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const history = useHistory();
  const [newBook, setNewBook] = useState({
    title: "",
    imageUrl: "",
    isbn: "",
    description: "",
    authorRef: "",
    categoryRef: "",
  });

  function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewBook({ ...newBook, [name]: value });
  };

  const handleAuthorsChange = (e) => {
    const selectedAuthors = Array.from(
      e.target.selectedOptions,
      (option) => option.value
    );
    setNewBook({
      ...newBook,
      authorRef: doc(db, "authors", selectedAuthors[0]),
    });
  };

  const handleCategoryChange = (e) => {
    const selectedCategory = Array.from(
      e.target.selectedOptions,
      (option) => option.value
    );
    setNewBook({
      ...newBook,
      categoryRef: doc(db, "categories", selectedCategory[0]),
    });
  };

  const handleEditBook = (book) => {
    setEditingBookId(book.id);
  };

  const handleDeleteBook = async (bookId) => {
    const confirmation = window.confirm(
      "Estas segur que vols eliminar aquest llibre?"
    );

    if (confirmation) {
      try {
        await deleteDoc(doc(db, "books", bookId));

        // After successful deletion, update the state to reflect the change
        setBooks((prevBooks) => prevBooks.filter((book) => book.id !== bookId));
      } catch (error) {
        console.error("Error deleting book:", error);
      }
    }
  };

  const fetchAuthors = async () => {
    const authorsRef = collection(db, "authors");
    console.log(authorsRef);
    const snapshot = await getDocs(authorsRef);
    const authorList = await Promise.all(
      snapshot.docs.map((doc2) => ({
        id: doc2.id,
        ...doc2.data(),
      }))
    );
    setAuthors(authorList);
  };

  const handleSaveBook = async (editedBook) => {
    try {
      // Update the book details in the database
      const bookRef = doc(db, "books", editedBook.id);
      await updateDoc(bookRef, {
        title: editedBook.title,
        imageUrl: editedBook.imageUrl,
        description: editedBook.description,
        isbn: editedBook.isbn,
        authorRef: editedBook.authorRef,
        categoryRef: editedBook.categoryRef,
        availableCopies: editedBook.availableCopies, // Save availableCopies
      });

      // Update the state to reflect the changes
      setBooks((prevBooks) =>
        prevBooks.map((book) => (book.id === editedBook.id ? editedBook : book))
      );

      // Reset the editing state
      setEditingBook(null);
    } catch (error) {
      console.error("Error updating book:", error);
    }
  };

  const fetchCategories = async () => {
    const categoriesRef = collection(db, "categories");
    console.log(categoriesRef);
    const snapshot = await getDocs(categoriesRef);
    const categoryList = await Promise.all(
      snapshot.docs.map((doc3) => ({
        id: doc3.id,
        ...doc3.data(),
      }))
    );
    setCategories(categoryList);
  };

  const handleCancelEdit = () => {
    setEditingBook(null);
  };

  const handleSubmitCreateBook = async (e) => {
    e.preventDefault();

    // Ensure availableCopies is an integer
    const availableCopies = parseInt(newBook.availableCopies, 10);

    const bookData = {
      title: newBook.title,
      imageUrl: newBook.imageUrl,
      description: newBook.description,
      authorRef: newBook.authorRef,
      categoryRef: newBook.categoryRef,
      availableCopies: availableCopies, // Save availableCopies
    };

    const docRef = await addDoc(collection(db, "books"), bookData).catch(
      (error) => {
        console.error("Error adding document: ", error);
      }
    );

    console.log("Document written with ID: ", docRef.id);

    setNewBook({
      title: "",
      imageUrl: "",
      description: "",
      authorRef: "",
      categoryRef: "",
      availableCopies: "", // Reset availableCopies
    });
  };

  const fetchBooks = async () => {
    const booksRef = collection(db, "books");
    const snapshot = await getDocs(booksRef);
    const fetchedBooks = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const bookData = doc.data();
        const authorRef = bookData.authorRef;
        const categoryRef = bookData.categoryRef;

        // Make sure authorRef is properly defined before using it
        if (authorRef) {
          const authorDoc = await getDoc(authorRef);
          const authorData = authorDoc.data();

          // Make sure categoryRef is properly defined before using it
          if (categoryRef) {
            const categoryDoc = await getDoc(categoryRef);
            const categoryData = categoryDoc.data();

            return {
              id: doc.id,
              ...bookData,
              author: authorData,
              category: categoryData,
            };
          } else {
            return {
              id: doc.id,
              ...bookData,
              author: authorData,
              category: { name: "null" },
            };
          }
        }

        return {
          id: doc.id,
          ...bookData,
          author: { name: null },
          category: { name: "null" },
        };
      })
    );
    setBooks(fetchedBooks);
  };

  const checkAdmin = async (user1) => {
    const q = query(
      collection(db, "admins"),
      where("email", "==", user1.email)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      history.push("/");
      await wait(100);
      window.location.reload();
    }
  };

  const backWhereYouCameFrom = async () => {
    history.push("/");
    await wait(100);
    window.location.reload();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        try {
          console.log(user);
          checkAdmin(user);
          fetchBooks();
          fetchAuthors();
          fetchCategories();
        } catch (e) {}
      } else {
        backWhereYouCameFrom();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [db]);

  return (
    <div>
      <section className="add-book-section">
        <h2>Afagir llibre</h2>
        <form className="add-book-form" onSubmit={handleSubmitCreateBook}>
          <label>
            Titol:
            <input
              type="text"
              name="title"
              value={newBook.title}
              onChange={handleInputChange}
            />
          </label>
          <label>
            ISBN:
            <textarea
              name="isbn"
              value={newBook.isbn}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Descripció:
            <textarea
              name="description"
              value={newBook.description}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Imatge URL:
            <textarea
              name="imageUrl"
              value={newBook.imageUrl}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Autor:
            <select name="authors" multiple onChange={handleAuthorsChange}>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria:
            <select name="categories" multiple onChange={handleCategoryChange}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Copies totals:
            <input
              type="number"
              name="availableCopies"
              value={newBook.availableCopies}
              onChange={handleInputChange}
            />
          </label>
          <button type="submit">Create</button>
        </form>
      </section>
      <section className="books-section">
        <h2>Llibres</h2>
        <table>
          <thead>
            <tr>
              <th>Titol</th>
              <th>Autor</th>
              <th>ISBN</th>
              <th>Categoria</th>
              <th>Copies totals</th>
              <th>Accions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <React.Fragment key={book.id}>
                <tr>
                  <Link
                    to={`/books/${book.id}`}
                    onClick={async () => {
                      await wait(100);
                      window.location.reload();
                    }}
                  >
                    {book.title}
                  </Link>
                  <td>{book.author.name}</td>
                  <td>{book.isbn}</td>
                  <td>{book.category.name}</td>
                  <td>{book.availableCopies}</td>
                  <td>
                    <button onClick={() => handleEditBook(book)}>Editar</button>
                    <button onClick={() => handleDeleteBook(book.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
                {editingBookId === book.id && (
                  <tr>
                    <td colSpan="4">
                      <EditBook
                        book={book}
                        onSave={handleSaveBook}
                        onCancel={() => setEditingBookId(null)} // Close edit form
                        authors={authors}
                        categories={categories}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>
      {editingBook && (
        <EditBook
          book={editingBook}
          onSave={handleSaveBook}
          onCancel={handleCancelEdit}
          authors={authors} // Pass the list of authors to the EditBook component
          categories={categories} // Pass the list of categories to the EditBook component
        />
      )}
    </div>
  );
};

export default Books;
