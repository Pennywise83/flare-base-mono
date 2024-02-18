/**
 * Represents a pair of values: data retrieved and missing data.
 *
 * @template T The type of data retrieved from the DAO.
 * @template U The type of missing data.
 */
export class DaoData<T, U> {
    data: T;
    missingData: U;
}