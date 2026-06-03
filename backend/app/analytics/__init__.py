"""Business-data warehouse (Firestore -> BigQuery) + analytics + forecasting.

Pool 4.6. The warehouse is OPTIONAL and flag-gated: nothing runs unless
``ANALYTICS_BQ_DATASET`` is set, so production is unaffected until enabled.
"""
