ALTER TABLE photo ADD COLUMN title text CHECK(title IS NULL OR length(title) BETWEEN 1 AND 200);
GRANT UPDATE(title) ON photo TO lumio_app;