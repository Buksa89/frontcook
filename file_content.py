import os
import sys
import pathspec

def load_gitignore_spec(root_path):
    gitignore_path = os.path.join(root_path, ".gitignore")
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
        return pathspec.PathSpec.from_lines("gitwildmatch", lines)
    return pathspec.PathSpec.from_lines("gitwildmatch", [])

def list_files_with_content(root_path, output_file, spec, indent=0, rel_path=""):
    ignored_names = {".git", "package-lock.json"}

    try:
        entries = sorted(os.listdir(root_path))
    except PermissionError:
        output_file.write("  " * indent + "[Permission Denied]\n")
        return

    for entry in entries:
        if entry in ignored_names:
            continue

        full_path = os.path.join(root_path, entry)
        relative_path = os.path.join(rel_path, entry)

        if spec.match_file(relative_path):
            continue

        if os.path.isdir(full_path):
            output_file.write("  " * indent + f"[📁] {entry}/\n")
            list_files_with_content(full_path, output_file, spec, indent + 1, relative_path)
        else:
            output_file.write("  " * indent + f"- {entry}\n")
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        for line in content.splitlines():
                            output_file.write("  " * (indent + 1) + line + "\n")
                    else:
                        output_file.write("  " * (indent + 1) + "[Pusty plik]\n")
            except Exception as e:
                output_file.write("  " * (indent + 1) + f"[Błąd odczytu: {e}]\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Użycie: python drzewo.py <ścieżka1> [ścieżka2 ...] [plik_wyjściowy.txt]")
        sys.exit(1)

    *paths, maybe_output = sys.argv[1:]

    if maybe_output.endswith(".txt"):
        output_path = maybe_output
        folder_paths = paths
    else:
        output_path = "output.txt"
        folder_paths = paths + [maybe_output]

    with open(output_path, "w", encoding='utf-8') as f:
        for folder_path in folder_paths:
            if not os.path.exists(folder_path):
                f.write(f"[⚠️] Ścieżka '{folder_path}' nie istnieje.\n\n")
                continue

            f.write(f"\n### 📂 ZAWARTOŚĆ: {folder_path} ###\n\n")
            gitignore_spec = load_gitignore_spec(folder_path)
            list_files_with_content(folder_path, f, gitignore_spec)

    print(f"Zapisano do pliku: {output_path}")
