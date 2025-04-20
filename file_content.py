import os
import sys

def list_files_with_content(root_path, output_file, indent=0):
    try:
        entries = sorted(os.listdir(root_path))
    except PermissionError:
        output_file.write("  " * indent + "[Permission Denied]\n")
        return

    for entry in entries:
        full_path = os.path.join(root_path, entry)
        if os.path.isdir(full_path):
            output_file.write("  " * indent + f"[📁] {entry}/\n")
            list_files_with_content(full_path, output_file, indent + 1)
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
        print("Użycie: python drzewo.py <ścieżka_do_folderu> [plik_wyjściowy]")
        sys.exit(1)

    folder_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "output.txt"

    if not os.path.exists(folder_path):
        print(f"Ścieżka '{folder_path}' nie istnieje.")
        sys.exit(1)

    with open(output_path, "w", encoding='utf-8') as f:
        list_files_with_content(folder_path, f)

    print(f"Zapisano do pliku: {output_path}")
