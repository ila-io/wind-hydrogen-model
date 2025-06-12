
import csv
from datetime import datetime, timedelta

def parse_row(row):
    try:
        timestamp = datetime.strptime(row[0], '%Y-%m-%d %H:%M:%S')
        values = [float(x) if x else None for x in row[1:]]
        return timestamp, values
    except:
        return None, [None] * (len(row) - 1)

def interpolate(value1, value2, ratio):
    if value1 is None or value2 is None:
        return None
    return value1 + (value2 - value1) * ratio

def round_half(x):
    return round(x * 2) / 2 if x is not None else None

input_file = 'TEST_RoscoeTimeWindPower_Hourly.csv'
output_file = 'TEST_RoscoeTimeWindPower_Hourly_Interpolated.csv'

with open(input_file, 'r', newline='') as f:
    reader = list(csv.reader(f))
    header = reader[0]
    rows = reader[1:]

data = []
for row in rows:
    ts, values = parse_row(row)
    if ts:
        data.append((ts, values))

# Interpolate missing hours
interpolated = []
i = 0
while i < len(data) - 1:
    ts1, val1 = data[i]
    ts2, val2 = data[i + 1]
    interpolated.append([ts1] + val1)

    delta_hours = int((ts2 - ts1).total_seconds() // 3600)
    for h in range(1, delta_hours):
        new_ts = ts1 + timedelta(hours=h)
        ratio = h / delta_hours
        interp_vals = [interpolate(v1, v2, ratio) for v1, v2 in zip(val1, val2)]
        # Recalculate rounded wind speed
        if interp_vals[0] is not None:
            interp_vals[2] = round_half(interp_vals[0])
        interpolated.append([new_ts] + interp_vals)

    i += 1

# Add the last row
interpolated.append([data[-1][0]] + data[-1][1])

# Write to output CSV
with open(output_file, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    for row in interpolated:
        writer.writerow([row[0].strftime('%Y-%m-%d %H:%M:%S')] + row[1:])
