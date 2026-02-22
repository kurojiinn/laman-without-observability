import SwiftUI

/// AuthMode определяет режим экрана аутентификации: регистрация или вход.
enum AuthMode {
    case register
    case login
}

/// AuthView отображает форму регистрации и входа с переключением режимов.
struct AuthView: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @State private var mode: AuthMode = .register
    @State private var phone: String = ""
    @State private var selectedRole: UserRole = .client
    @State private var otpCode: String = ""

    var body: some View {
        Form {
            if authVM.isAwaitingCode {
                Section {
                    Text("Введите последние 4 цифры номера входящего звонка")
                        .frame(maxWidth: .infinity, alignment: .center)
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    TextField("0000", text: $otpCode)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .font(.title2.monospacedDigit())
                        .frame(maxWidth: .infinity, alignment: .center)
                        .onChange(of: otpCode) { newValue in
                            otpCode = String(newValue.filter(\.isNumber).prefix(4))
                            if otpCode.count == 4, authVM.state != .loading {
                                Task {
                                    await authVM.verifyCode(otpCode)
                                }
                            }
                        }

                    Button("Подтвердить") {
                        Task {
                            await authVM.verifyCode(otpCode)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .disabled(otpCode.count != 4 || authVM.state == .loading)

                    Button("Отправить код повторно") {
                        Task { await authVM.resendCode() }
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .foregroundStyle(.blue.opacity(authVM.secondsUntilResend > 0 ? 0.5 : 1.0))
                    .disabled(authVM.secondsUntilResend > 0 || authVM.state == .loading)

                    if authVM.secondsUntilResend > 0 {
                        Text("Повторная отправка через \(authVM.secondsUntilResend) сек")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Button("Изменить номер телефона") {
                        goBackToPhoneInput()
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                } header: {
                    HStack {
                        Spacer()
                        Text("Код подтверждения")
                        Spacer()
                    }
                }
            } else {
                Section(mode == .register ? "Регистрация" : "Вход") {
                    TextField("79640691596", text: $phone)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.numberPad)
                        .onChange(of: phone) { newValue in
                            phone = String(newValue.filter(\.isNumber).prefix(11))
                        }
                }

                if mode == .register {
                    Section("Тип аккаунта") {
                        Picker("Роль", selection: $selectedRole) {
                            ForEach(UserRole.allCases) { role in
                                Text(role == .client ? "Стать клиентом" : "Стать курьером").tag(role)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                }

                Section {
                    Button {
                        Task {
                            let intent: AuthIntent = mode == .register ? .register : .login
                            let role: UserRole? = mode == .register ? selectedRole : nil
                            await authVM.requestCode(phone: phone, role: role, intent: intent)
                        }
                    } label: {
                        if authVM.state == .loading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(mode == .register ? "Зарегистрироваться" : "Войти")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || authVM.state == .loading)

                    Button(mode == .register ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться") {
                        mode = mode == .register ? .login : .register
                        phone = ""
                        otpCode = ""
                        authVM.resetOTPFlow()
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .navigationTitle(authVM.isAwaitingCode ? "Подтверждение" : (mode == .register ? "Авторизация" : "Вход"))
        .toolbar {
            if authVM.isAwaitingCode {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Назад") {
                        goBackToPhoneInput()
                    }
                }
            }
        }
        .alert("Ошибка", isPresented: isErrorAlertPresented) {
            Button("OK", role: .cancel) {
                authVM.resetError()
            }
        } message: {
            Text(errorMessage)
        }
    }

    /// Возвращает пользователя к первому шагу авторизации и очищает поля ввода.
    private func goBackToPhoneInput() {
        phone = ""
        otpCode = ""
        authVM.resetOTPFlow()
    }

    /// Возвращает текст последней ошибки для показа в alert.
    private var errorMessage: String {
        if case .error(let message) = authVM.state {
            return message
        }
        return "Произошла неизвестная ошибка"
    }

    /// Управляет показом alert при ошибках аутентификации.
    private var isErrorAlertPresented: Binding<Bool> {
        Binding(
            get: {
                if case .error = authVM.state {
                    return true
                }
                return false
            },
            set: { value in
                if !value {
                    authVM.resetError()
                }
            }
        )
    }
}

/// ProfileView отображает личный кабинет в зависимости от роли пользователя.
struct ProfileView: View {
    @EnvironmentObject private var authVM: AuthViewModel

    var body: some View {
        List {
            if let user = authVM.user {
                Section("Профиль") {
                    Text("Телефон: \(user.phone)")
                    Text("Роль: \(user.role.displayName)")
                }
            }

            switch authVM.user?.role {
            case .courier:
                Section("Мои активные заказы") {
                    Text("Здесь будут текущие доставки")
                }
                Section("Статистика заработка") {
                    Text("Здесь будет статистика по доходу")
                }
            case .client:
                Section("Мои покупки") {
                    Text("Здесь будет история покупок")
                }
                Section("Бонусная программа") {
                    Text("Здесь будут бонусы и акции")
                }
            case .none:
                Section {
                    Text("Пользователь не авторизован")
                }
            }

            Section {
                Button("Выйти", role: .destructive) {
                    authVM.logout()
                }
            }
        }
        .navigationTitle("Личный кабинет")
    }
}
