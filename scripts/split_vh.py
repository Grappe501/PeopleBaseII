import csv
import os

input_file = r"C:\Users\User\Desktop\peoplebase_app\data\vh.csv"
output_dir = r"C:\Users\User\Desktop\peoplebase_app\data\chunks\vh"
chunk_size = 50000

os.makedirs(output_dir, exist_ok=True)

with open(input_file, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)

    file_count = 1
    row_count = 0

    out_file = open(
        os.path.join(output_dir, f"vh_part_{file_count:03}.csv"),
        "w",
        newline='',
        encoding='utf-8'
    )
    writer = csv.writer(out_file)
    writer.writerow(header)

    for row in reader:
        writer.writerow(row)
        row_count += 1

        if row_count >= chunk_size:
            out_file.close()
            file_count += 1
            row_count = 0

            out_file = open(
                os.path.join(output_dir, f"vh_part_{file_count:03}.csv"),
                "w",
                newline='',
                encoding='utf-8'
            )
            writer = csv.writer(out_file)
            writer.writerow(header)

    out_file.close()

print(f"Done. Created {file_count} files.")