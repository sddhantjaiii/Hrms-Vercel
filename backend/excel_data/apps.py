from django.apps import AppConfig


class ExcelDataConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'excel_data'

    def ready(self):
        import excel_data.signals
