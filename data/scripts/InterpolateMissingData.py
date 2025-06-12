import pandas as pd
import numpy as np
from pathlib import Path


def interpolateMissingValues(df, missing_value = -1):
    '''
    interpolate missing values (-1 by default) in a DataFrame using linear interpolation. 

    Parameters:
    df (pd.DataFrame): Input dataframe
    missing_value: Value to treat as missing (default: -1)

    Returns:
    pd.DataFrame: DataFrame with interpolated values    
    '''


    df_interpolated = df.copy()

    df_interpolated = df_interpolated.replace(missing_value, np.nan)

    for column in df_interpolated.columns:
        if df_interpolated[column].dtype in ['float64', 'int64']:
            df_interpolated[column] = df_interpolated[column].interpolate(method='linear')

    return df_interpolated



def processCSV(inputFile, outputFile = None, missingValue = -1):

    df = pd.read_csv(inputFile)

    missingCounts = {}
    for col in df.columns:
        if df[col].dtype in ['float64', 'int64']:
            missingCount = (df[col] == missingValue).sum()
            if missingCount > 0:
                missingCounts[col] = missingCount

    
    if missingCounts == True:
        print(f"\nmissing values:")
        for col, count in missingCounts.items():
            print("f {col}: {count} missing values")

    else:
        print(f"\nno missing values ({missingValue})")

    df_interpolated = interpolateMissingValues(df, missingValue)

    print(f"\ninterpolation finished")

    if outputFile:
        df_interpolated.to_csv(outputFile, index = False)
        print(f"\ndata saved to: {outputFile}") 

    return df_interpolated
    



if __name__ == "__main__":
    inputFile = "../TEST_RoscoeTimeWindPower_Hourly.csv"
    outputFile = "../interpolated_data.csv"

    result = processCSV(inputFile, outputFile)
    if result is not None:
        print("processing succesful")