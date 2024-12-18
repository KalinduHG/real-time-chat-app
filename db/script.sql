USE [master]
GO
/****** Object:  Database [ChatAppDB]    Script Date: 11/21/2024 12:44:23 AM ******/
CREATE DATABASE [ChatAppDB]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'ChatAppDB', FILENAME = N'C:\Users\USER\ChatAppDB.mdf' , SIZE = 8192KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'ChatAppDB_log', FILENAME = N'C:\Users\USER\ChatAppDB_log.ldf' , SIZE = 8192KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT
GO
ALTER DATABASE [ChatAppDB] SET COMPATIBILITY_LEVEL = 150
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [ChatAppDB].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [ChatAppDB] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [ChatAppDB] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [ChatAppDB] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [ChatAppDB] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [ChatAppDB] SET ARITHABORT OFF 
GO
ALTER DATABASE [ChatAppDB] SET AUTO_CLOSE ON 
GO
ALTER DATABASE [ChatAppDB] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [ChatAppDB] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [ChatAppDB] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [ChatAppDB] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [ChatAppDB] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [ChatAppDB] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [ChatAppDB] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [ChatAppDB] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [ChatAppDB] SET  ENABLE_BROKER 
GO
ALTER DATABASE [ChatAppDB] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [ChatAppDB] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [ChatAppDB] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [ChatAppDB] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [ChatAppDB] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [ChatAppDB] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [ChatAppDB] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [ChatAppDB] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [ChatAppDB] SET  MULTI_USER 
GO
ALTER DATABASE [ChatAppDB] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [ChatAppDB] SET DB_CHAINING OFF 
GO
ALTER DATABASE [ChatAppDB] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [ChatAppDB] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [ChatAppDB] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [ChatAppDB] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [ChatAppDB] SET QUERY_STORE = OFF
GO
USE [ChatAppDB]
GO
/****** Object:  Table [dbo].[Messages]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Messages](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SenderId] [int] NOT NULL,
	[ReceiverId] [int] NOT NULL,
	[Message] [nvarchar](max) NULL,
	[Timestamp] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[PasswordHash] [nvarchar](256) NOT NULL,
	[OnlineStatus] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Messages] ADD  DEFAULT (getdate()) FOR [Timestamp]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ((0)) FOR [OnlineStatus]
GO
ALTER TABLE [dbo].[Messages]  WITH CHECK ADD FOREIGN KEY([ReceiverId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Messages]  WITH CHECK ADD FOREIGN KEY([SenderId])
REFERENCES [dbo].[Users] ([Id])
GO
/****** Object:  StoredProcedure [dbo].[sp_GetChatMessages]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetChatMessages]
    @SenderId INT,
    @ReceiverId INT
AS
BEGIN
    SELECT [Id], [SenderId], [ReceiverId], [Message], [Timestamp]
    FROM [ChatAppDB].[dbo].[Messages]
    WHERE 
        (SenderId = @SenderId AND ReceiverId = @ReceiverId) 
        OR 
        (SenderId = @ReceiverId AND ReceiverId = @SenderId)
    ORDER BY [Timestamp] ASC;
END

GO
/****** Object:  StoredProcedure [dbo].[sp_GetUserDetails]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetUserDetails]
    @UserId INT
AS
BEGIN
    SELECT 
        Id,
        Username,
        CASE 
            WHEN OnlineStatus = 1 THEN 'Online'
            ELSE 'Offline'
        END AS OnlineStatus
    FROM Users
    WHERE Id = @UserId
END
GO
/****** Object:  StoredProcedure [dbo].[sp_LoginUser]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_LoginUser]
    @Username NVARCHAR(100),
    @UserId INT OUTPUT,
    @PasswordHash NVARCHAR(255) OUTPUT,
    @OnlineStatus BIT OUTPUT 
AS
BEGIN
    -- Retrieve the user's password hash and online status
    SELECT @PasswordHash = PasswordHash, @UserId = Id, @OnlineStatus = OnlineStatus
    FROM Users
    WHERE Username = @Username;

    
    IF @PasswordHash IS NULL
    BEGIN
        RAISERROR('Invalid username or password.', 16, 1);
        RETURN;
    END

END
GO
/****** Object:  StoredProcedure [dbo].[sp_RegisterUser]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_RegisterUser]
    @Username NVARCHAR(100),
    @PasswordHash NVARCHAR(255),
    @OnlineStatus BIT = 0
AS
BEGIN
    -- Check if the username already exists
    IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
    BEGIN
        RAISERROR('Username already exists.', 16, 1);
        RETURN;
    END

   
    -- Insert the new user into the Users table
    INSERT INTO Users (Username, PasswordHash, OnlineStatus)
    VALUES (@Username, @PasswordHash, @OnlineStatus);
END
GO
/****** Object:  StoredProcedure [dbo].[sp_SaveChatMessage]    Script Date: 11/21/2024 12:44:24 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[sp_SaveChatMessage]
    @SenderId INT,
    @ReceiverId INT,
    @Message NVARCHAR(MAX),
    @SentAt DATETIME
AS
BEGIN
    INSERT INTO [dbo].[Messages](SenderId, ReceiverId, [Message], [Timestamp])
    VALUES (@SenderId, @ReceiverId, @Message, GetDate());
END
GO
USE [master]
GO
ALTER DATABASE [ChatAppDB] SET  READ_WRITE 
GO
