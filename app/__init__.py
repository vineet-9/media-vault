from flask import Flask, jsonify, redirect, render_template, request, session, url_for

from .config import ID_DIGIT_LENGTH, SESSION_SECRET
from .database import get_db, init_db, log_activity
from .errors import ApiError
from .routers.admin import admin_bp
from .routers.public import public_bp
from .security import verify_password


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SESSION_SECRET

    with app.app_context():
        init_db()

    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)

    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        return jsonify({"detail": err.message}), err.status_code

    # ---- Public: anyone can look a machine up, no account needed --------
    @app.route("/")
    def root():
        return render_template("public.html", id_length=ID_DIGIT_LENGTH)

    # ---- Admin: separate, login-gated area for CRUD --------------------
    @app.route("/admin/login", methods=["GET", "POST"])
    def admin_login():
        if request.method == "GET":
            if session.get("admin"):
                return redirect(url_for("admin_page"))
            return render_template("admin_login.html")

        username = request.form.get("username", "")
        password = request.form.get("password", "")

        conn = get_db()
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND role = 'admin'", (username,)
        ).fetchone()
        conn.close()

        if not row or not verify_password(password, row["salt"], row["password_hash"]):
            log_activity(username or None, None, "admin_login_failed")
            return render_template(
                "admin_login.html", error="Incorrect username or password."
            ), 401

        session["admin"] = {"username": row["username"]}
        log_activity(row["username"], "admin", "admin_login_success")
        return redirect(url_for("admin_page"))

    @app.route("/admin/logout")
    def admin_logout():
        session.clear()
        return redirect(url_for("root"))

    @app.route("/admin")
    def admin_page():
        admin = session.get("admin")
        if not admin:
            return redirect(url_for("admin_login"))
        return render_template("admin.html", admin=admin, id_length=ID_DIGIT_LENGTH)

    return app
